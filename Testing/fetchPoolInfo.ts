import { Connection, PublicKey } from '@solana/web3.js'
const {
    Liquidity,
    Market,
    findProgramAddress,
    LIQUIDITY_STATE_LAYOUT_V4,
    MARKET_STATE_LAYOUT_V3,
    SPL_MINT_LAYOUT,
} = require('@raydium-io/raydium-sdk')
async function main() {
  const connection = new Connection(
    'https://virulent-blissful-telescope.solana-mainnet.quiknode.pro/26de2cab003c22f3f4885049f9aefc7e285dd4a8/',
    'confirmed'
  )
// const poolKeys =  {
//     id: new PublicKey("58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"),
//     baseMint: new PublicKey("So11111111111111111111111111111111111111112"),
//     quoteMint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
//     lpMint: new PublicKey("8HoQnePLqPj4M7PUDzfw8e3Ymdwgc7NLGnaTUapubyvu"),
//     baseDecimals: 9,
//     quoteDecimals: 6,
//     lpDecimals: 9,
//     version: 4 as const,
//     programId: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
//     authority: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
//     openOrders: new PublicKey("HmiHHzq4Fym9e1D4qzLS6LDDM3tNsCTBPDWHTLZ763jY"),
//     targetOrders: new PublicKey("CZza3Ej4Mc58MnxWA385itCC9jCo3L1D7zc3LKy1bZMR"),
//     baseVault: new PublicKey("DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz"),
//     quoteVault: new PublicKey("HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz"),
//     withdrawQueue: new PublicKey("11111111111111111111111111111111"),
//     lpVault: new PublicKey("11111111111111111111111111111111"),
//     marketVersion: 3 as const, // ⚠️ Must be 3 for Liquidity.fetchInfo to work
//     marketProgramId: new PublicKey("srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"),
//     marketId: new PublicKey("8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6"),
//     marketAuthority: new PublicKey("CTz5UMLQm2SRWHzQnU62Pi4yJqbNGjgRBHqqp6oDHfF7"),
//     marketBaseVault: new PublicKey("CKxTHwM9fPMRRvZmFnFoqKNd9pQR21c5Aq9bh5h9oghX"),
//     marketQuoteVault: new PublicKey("6A5NHCj1yF6urc9wZNe6Bcjj4LVszQNj5DwAWG97yzMu"),
//     marketBids: new PublicKey("5jWUncPNBMZJ3sTHKmMLszypVkoRK6bfEQMQUHweeQnh"),
//     marketAsks: new PublicKey("EaXdHx7x3mdGA38j5RSmKYSXMzAFzzUXCLNBEDXDn1d5"),
//     marketEventQueue: new PublicKey("8CvwxZ9Db6XbLD46NZwwmVDZZRDy7eydFcAGkXKh9axa"),
//     lookupTableAccount: new PublicKey("3q8sZGGpPESLxurJjNmr7s7wcKS5RPCCHMagbuHP9U2W"),
//   }
  const poolKeys = {
    id: new PublicKey('23Jwiqctvk2j2mf968zg6VK7vAbsnsmySPxDGfT1Wpor'),
    baseMint: new PublicKey('So11111111111111111111111111111111111111112'),
    quoteMint: new PublicKey('3S4TR57k47JFYcjNVY3uJZFxtCcBvwKaLzjiuD9y1Hvx'),
    lpMint: new PublicKey('2q5koXuQrZj35AeDpCLbEeyLBM33qCNPbsjbURmL8XiV'),
    baseDecimals: 9,
    quoteDecimals: 6,
    lpDecimals: 6,
    version: 4 as const,
    programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
    authority: new PublicKey('EuBzGUNnjPS2tdtnA8goFjxSZgKqPzN7Bior8Y2BdtXD'),
    openOrders: new PublicKey('Ew1d1f8BC3KKtpn3Bh4dWMsnQfeYg44W1GvMcFXGwM5v'),
    targetOrders: new PublicKey('CZza3Ej4Mc58MnxWA385itCC9jCo3L1D7zc3LKy1bZMR'),
    baseVault: new PublicKey('7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5'),
    quoteVault: new PublicKey('HLdssVUQfCzxF56pVtFKE2hkjWs9GG7PffvEVwYu7Sw'),
    withdrawQueue: new PublicKey('11111111111111111111111111111111'),
    lpVault: new PublicKey('11111111111111111111111111111111'),
    marketVersion: 3 as const,
    marketProgramId: new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'),
    marketId: new PublicKey('FqRm3YCFgwxkjjfXrPRWukhLZaXHJGjPhChfddBsTFKX'),
    marketAuthority: new PublicKey('CTz5UMLQm2SRWHzQnU62Pi4yJqbNGjgRBHqqp6oDHfF7'),
    marketBaseVault: new PublicKey('CKxTHwM9fPMRRvZmFnFoqKNd9pQR21c5Aq9bh5h9oghX'),
    marketQuoteVault: new PublicKey('6A5NHCj1yF6urc9wZNe6Bcjj4LVszQNj5DwAWG97yzMu'),
    marketBids: new PublicKey('5jWUncPNBMZJ3sTHKmMLszypVkoRK6bfEQMQUHweeQnh'),
    marketAsks: new PublicKey('EaXdHx7x3mdGA38j5RSmKYSXMzAFzzUXCLNBEDXDn1d5'),
    marketEventQueue: new PublicKey('8CvwxZ9Db6XbLD46NZwwmVDZZRDy7eydFcAGkXKh9axa'),
    lookupTableAccount: new PublicKey('3q8sZGGpPESLxurJjNmr7s7wcKS5RPCCHMagbuHP9U2W'),
  }

  const account = await connection.getAccountInfo(poolKeys.id)

  if (account === null) throw Error(' get id info error ')
  const info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data)
  console.log("info:", info);
  const marketId = poolKeys.marketId
  const marketAccount = await connection.getAccountInfo(marketId)
  if (marketAccount === null) throw Error(' get market info error')

  const lpMint = poolKeys.lpMint
  const lpMintAccount = await connection.getAccountInfo(lpMint)
  if (lpMintAccount === null) throw Error(' get lp mint info error')
  const lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data)

  console.log('Pool Keys:', lpMintInfo)
  const supply = lpMintInfo?.supply.toString()
  console.log('supply::::::', supply)

if (supply === '0') {
  console.warn('⚠️ Pool is likely uninitialized. LP token supply is 0.')
}
  for (const [key, value] of Object.entries(poolKeys)) {
    console.log(`- ${key}:`, value.toString?.() || value)
  }

  try {
    const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys })
    console.log('\nPool Info:', JSON.stringify(poolInfo, null, 2))
  } catch (error: any) {
    console.error('\nError fetching pool info:')
    console.error('Message:', error.message)
    console.error('Reason:', error.reason)
    console.error('Code:', error.code)
    console.error('Stack:', error.stack)
  }
}

main().catch(console.error)
