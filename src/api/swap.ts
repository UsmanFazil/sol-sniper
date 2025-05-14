import {
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
  PublicKey,
} from '@solana/web3.js'
import { NATIVE_MINT } from '@solana/spl-token'
import axios from 'axios'
import { connection, owner, fetchTokenAccountData } from '../config'
import { API_URLS } from '@raydium-io/raydium-sdk-v2'

interface SwapCompute {
  id: string
  success: true
  version: 'V0' | 'V1'
  data: {
    swapType: 'BaseIn' | 'BaseOut'
    inputMint: string
    inputAmount: string
    outputMint: string
    outputAmount: string
    otherAmountThreshold: string
    slippageBps: number
    priceImpactPct: number
    routePlan: {
      poolId: string
      inputMint: string
      outputMint: string
      feeMint: string
      feeRate: number
      feeAmount: string
    }[]
  }
}

export const apiSwap = async ({
  inputMint,
  outputMint,
  amount = 0.01 * 1e9,
  slippage = 0.5
} = {} as {
  inputMint: string
  outputMint: string
  amount?: number
  slippage?: number
}) => {
  const txVersion = 'V0'
  const isV0Tx = txVersion === 'V0'

  const [isInputSol, isOutputSol] = [
    inputMint === NATIVE_MINT.toBase58(),
    outputMint === NATIVE_MINT.toBase58(),
  ]

  const { tokenAccounts } = await fetchTokenAccountData()
  const inputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === inputMint)?.publicKey
  const outputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === outputMint)?.publicKey

  if (!inputTokenAcc && !isInputSol) {
    console.error('❌ Missing input token account')
    return
  }

  const { data: priorityFeeResp } = await axios.get<{
    id: string
    success: boolean
    data: { default: { vh: number; h: number; m: number } }
  }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`)

  const { data: swapResponse } = await axios.get<SwapCompute>(
    `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
  )

  if (!swapResponse?.data?.routePlan?.length) {
    console.error('❌ No swap route found. Try increasing amount or check tokens.')
    console.dir(swapResponse, { depth: null })
    return
  }

  console.log('✅ Swap quote:', {
    outputAmount: swapResponse.data.outputAmount,
    routePlan: swapResponse.data.routePlan.map((r) => r.poolId),
  })

  const txPayload = {
    computeUnitPriceMicroLamports: String(priorityFeeResp.data.default.h),
    swapResponse,
    txVersion,
    wallet: owner.publicKey.toBase58(),
    wrapSol: isInputSol,
    unwrapSol: isOutputSol,
    inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
    outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58(),
  }

  console.log('📤 Sending transaction to Raydium...')
  const { data: swapTransactions } = await axios.post<{
    id: string
    version: string
    success: boolean
    data: { transaction: string }[]
  }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, txPayload)

  if (!swapTransactions?.data?.length) {
    console.error('❌ No transactions returned from Raydium API')
    console.dir(swapTransactions, { depth: null })
    return
  }

  const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'))
  const allTransactions = allTxBuf.map((txBuf) =>
    isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
  )

  console.log(`🔁 Executing ${allTransactions.length} transaction(s)...`)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')

  let idx = 0
  for (const tx of allTransactions) {
    idx++
    const transaction = tx as VersionedTransaction
    transaction.sign([owner])

    const txId = await connection.sendTransaction(transaction, { skipPreflight: true })

    console.log(`🔄 Sending v0 tx ${idx}: ${txId}`)

    await connection.confirmTransaction(
      {
        blockhash,
        lastValidBlockHeight,
        signature: txId,
      },
      'confirmed'
    )

    console.log(`✅ Confirmed v0 tx ${idx}`)
  }
}
