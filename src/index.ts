import mongoose from 'mongoose';
import RaydiumSwap from './RaydiumSwap';
import { VersionedTransaction } from '@solana/web3.js';
import 'dotenv/config';
import { swapConfig } from './swapConfig'; // Import the configuration
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  PublicKey,
  Connection,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/raydium_swaps')
.then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Define a schema for storing swap details
const swapSchema = new mongoose.Schema({
  baseToken: String,
  quoteToken: String,
  amount: Number,
  txid: String,
  status: String,  // 'Success' or 'Failed'
  errorMessage: String, // Store error if any
  timestamp: { type: Date, default: Date.now },
});

const SwapModel = mongoose.model('Swap', swapSchema);

// Function to save swap details
const saveSwapDetails = async (data: any) => {
  try {
    const swapEntry = new SwapModel(data);
    await swapEntry.save();
    console.log('✅ Swap details saved to MongoDB');
  } catch (error) {
    console.error('❌ Failed to save swap details:', error);
  }
};



/**
 * Performs a token swap on the Raydium protocol.
 * Depending on the configuration, it can execute the swap or simulate it.
 */
const swap = async () => {
  /**
   * The RaydiumSwap instance for handling swaps.
   */
  // Read CLI arguments: 1st = file path, 2nd = JSON config
  var directory = "./LPJson"; // Change this to your desired directory
  const filePath =  `${directory}/output_${process.argv[4]}.json`;
  const baseToken = process.argv[2];
  const quoteToken = process.argv[3];

  if (!process.argv[4] || !baseToken || !quoteToken) {
    console.log(" File Path:", process.argv);
    console.log(" base and quote:", baseToken, quoteToken,filePath);
    console.error("❌ Missing required arguments. Usage: swap.ts <filePath> <baseToken> <quoteToken>");
    process.exit(1);
  }

  console.log("✅ File Path:", filePath);
  console.log("✅ base and quote:", baseToken, quoteToken);

  var swapConfig = {
    executeSwap: false, // Send tx when true, simulate tx when false
    useVersionedTransaction: true,
    tokenAAmount: 0.01, // Swap 0.01 SOL for USDT in this example
    tokenAAddress: baseToken, // Token to swap for the other, SOL in this case
    tokenBAddress: quoteToken, // USDC address
    maxLamports: 1000000, // Max lamports allowed for fees
    direction: "in" as "in" | "out", // Swap direction: 'in' or 'out'
    liquidityFile: filePath,
    maxRetries: 10
  };

  const raydiumSwap = new RaydiumSwap(process.env.RPC_URL, process.env.WALLET_PRIVATE_KEY);
  console.log(`Raydium swap initialized`);
  console.log(`Swapping ${swapConfig.tokenAAmount} of ${swapConfig.tokenAAddress} for ${swapConfig.tokenBAddress}...`)

  /**
   * Load pool keys from the Raydium API to enable finding pool information.
   */
  await raydiumSwap.loadPoolKeys(filePath);
  console.log(`Loaded pool keys`);


  await saveSwapDetails({
    baseToken,
    quoteToken,
    amount: 22,
    txid: null,
    status: "Loading pool keys",
    errorMessage: null,
  });
  
  /**
   * Find pool information for the given token pair.
   */
  const poolInfo = raydiumSwap.findPoolInfoForTokens(swapConfig.tokenAAddress, swapConfig.tokenBAddress);
  if (!poolInfo) {
    console.error('Pool info not found');

      await saveSwapDetails({
        baseToken,
        quoteToken,
        amount: swapConfig.tokenAAmount,
        txid: null,
        status: "Failed",
        errorMessage: "Pool info not found",
      });

    return 'Pool info not found';
  } else {
    console.log('Found pool info');
    await saveSwapDetails({
      baseToken,
      quoteToken,
      amount: swapConfig.tokenAAmount,
      txid: null,
      status: "good1",
      errorMessage: "Pool info found",
    });
  }

  try {
    const t1 = swapConfig.tokenBAddress
    const t2 = swapConfig.tokenAAmount

    await saveSwapDetails({
      baseToken,
      quoteToken,
      amount: swapConfig.tokenAAmount,
      txid: null,
      status: "swapping starts",
      errorMessage: "swapping starts",
    });

    
    
  /**
   * Prepare the swap transaction with the given parameters.
   */
  const tx = await raydiumSwap.getSwapTransaction(
    swapConfig.tokenBAddress,
    swapConfig.tokenAAmount,
    poolInfo,
    swapConfig.maxLamports, 
    swapConfig.useVersionedTransaction,
    swapConfig.direction
  );

  await saveSwapDetails({
    baseToken,
    quoteToken,
    amount: 16,
    txid: null,
    status: "getSwapTransaction",
    errorMessage: "ata",
  });
  const connection = new Connection(process.env.RPC_URL!, "confirmed");
  const walletKeypair = raydiumSwap.wallet; // Assuming wallet is a Keypair
  const walletPublicKey = walletKeypair.publicKey;
  
  const tokenAMint = new PublicKey(swapConfig.tokenAAddress);
  const tokenBMint = new PublicKey(swapConfig.tokenBAddress);
  
  const tokenAATA = await getAssociatedTokenAddress(tokenAMint, walletPublicKey);
  const tokenBATA = await getAssociatedTokenAddress(tokenBMint, walletPublicKey);
  
  const tokenAInfo = await connection.getAccountInfo(tokenAATA);
  const tokenBInfo = await connection.getAccountInfo(tokenBATA);
  
  const ataInstructions: Transaction = new Transaction();
  
  if (!tokenAInfo) {
    console.warn(`⚠️ Creating missing ATA for token A: ${swapConfig.tokenAAddress}`);
    ataInstructions.add(
      createAssociatedTokenAccountInstruction(
        walletPublicKey,
        tokenAATA,
        walletPublicKey,
        tokenAMint
      )
    );
  }
  
  if (!tokenBInfo) {
    console.warn(`⚠️ Creating missing ATA for token B: ${swapConfig.tokenBAddress}`);
    ataInstructions.add(
      createAssociatedTokenAccountInstruction(
        walletPublicKey,
        tokenBATA,
        walletPublicKey,
        tokenBMint
      )
    );
  }
  const walletKeypair1 = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY!))
  );
  // Only send if at least one ATA was missing
  if (ataInstructions.instructions.length > 0) {
    await sendAndConfirmTransaction(connection, ataInstructions, [walletKeypair1]);
    console.log("✅ ATA(s) created");
  }
  
  await saveSwapDetails({
    tokenAInfo,
    tokenBInfo,
    amount: 19,
    txid: null,
    status: "ata",
    errorMessage: "ata",
  });

  /**
   * Depending on the configuration, execute or simulate the swap.
   */
  if (swapConfig.executeSwap) {

    await saveSwapDetails({
      baseToken,
      quoteToken,
      amount: 10,
      txid: null,
      status: "executeSwap",
    });
    /**
     * Send the transaction to the network and log the transaction ID.
     */
    const txid = swapConfig.useVersionedTransaction
      ? await raydiumSwap.sendVersionedTransaction(tx as VersionedTransaction, swapConfig.maxRetries)
      : await raydiumSwap.sendLegacyTransaction(tx as Transaction, swapConfig.maxRetries);

    console.log(` Swap Successful: https://solscan.io/tx/${txid}`);

    await saveSwapDetails({
      baseToken,
      quoteToken,
      amount: swapConfig.tokenAAmount,
      txid,
      status: "Success",
      errorMessage: null,
    });

  } else {
    /**
     * Simulate the transaction and log the result.
     */
    await saveSwapDetails({
      baseToken,
      quoteToken,
      amount: 10,
      txid: null,
      status: "Swapping done in progress",
    });
    const simRes = swapConfig.useVersionedTransaction
      ? await raydiumSwap.simulateVersionedTransaction(tx as VersionedTransaction)
      : await raydiumSwap.simulateLegacyTransaction(tx as Transaction);

    console.log(simRes);
    await saveSwapDetails({ 
      baseToken,
      quoteToken,
      amount: swapConfig.tokenAAmount,
      txid: null,
      status: "simulate successful",
      errorMessage: null,
    });

  }
} catch (error: any) {
  console.error("❌ Swap Failed:", error.message);
  
  await saveSwapDetails({
    baseToken,
    quoteToken,
    amount: swapConfig.tokenAAmount,
    txid: null,
    status: "Failed error",
    errorMessage: JSON.stringify(error),
  });
}
};

swap();
