#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { apiSwap } from '../api/swap'; // Import the original apiSwap

// Define the structure of the CLI output
interface CliSwapResult {
    success: boolean;
    txIds?: string[];
    error?: string;
}

// Function to capture console output
function captureConsole(callback: () => Promise<void>): Promise<{ stdout: string, stderr: string }> {
    const originalLog = console.log;
    const originalError = console.error;
    let stdout = '';
    let stderr = '';

    console.log = (...args: any[]) => {
        stdout += args.join(' ') + '\n';
    };
    console.error = (...args: any[]) => {
        stderr += args.join(' ') + '\n';
    };

    return callback().finally(() => {
        console.log = originalLog;
        console.error = originalError;
    }).then(() => ({ stdout, stderr }));
}

// 1. Parse flags
const argv = yargs(hideBin(process.argv))
  .strict()
  .option('inputMint',  { type: 'string', demandOption: true, description: 'Input token mint address' })
  .option('outputMint', { type: 'string', demandOption: true, description: 'Output token mint address' })
  .option('amount',     { type: 'number', demandOption: true, description: 'Amount of input token (in its smallest unit, e.g., lamports for SOL)' })
  .option('slippage',   { type: 'number', default: 0.5, description: 'Slippage tolerance in percentage (e.g., 0.5 for 0.5%)' })
  .help()
  .parseSync();

// 2. Invoke apiSwap, capture output, and output JSON result
(async () => {
  const { inputMint, outputMint, amount, slippage } = argv;
  let result: CliSwapResult = { success: false, error: 'An unexpected error occurred' };
  let exitCode = 1;

  try {
    // Capture the console output from the original apiSwap function
    const { stdout, stderr } = await captureConsole(async () => {
        // Note: The original apiSwap expects amount in smallest units (like lamports)
        // Ensure the 'amount' argument passed from Python is in the correct unit.
        await apiSwap({
            inputMint,
            outputMint,
            amount, // Use the parsed amount directly
            slippage,
        });
    });

    // Simple parsing based on expected console logs from the original apiSwap
    // This is fragile and depends on the exact log messages.
    if (stdout.includes('✅ Swap quote:') && stdout.includes('✅ Confirmed v0 tx')) {
        // Attempt to extract transaction IDs from the captured stdout
        const txIdMatch = stdout.match(/🔄 Sending v0 tx \d+: (.*)/g);
        const txIds = txIdMatch ? txIdMatch.map(match => match.split(': ')[1]) : [];

        result = { success: true, txIds: txIds.length > 0 ? txIds : undefined };
        exitCode = 0;
    } else if (stderr.includes('❌ Missing input token account')) {
        result = { success: false, error: 'Missing input token account' };
    } else if (stderr.includes('❌ No swap route found')) {
         result = { success: false, error: 'No swap route found. Try increasing amount or check tokens.' };
    } else if (stderr.includes('❌ No transactions returned')) {
         result = { success: false, error: 'No transactions returned from Raydium API' };
    } else if (stderr.length > 0) {
        // Capture any other stderr as a generic error
        result = { success: false, error: stderr.trim() };
    } else if (stdout.length > 0) {
         // Capture any other stdout as a generic error if not a clear success
         result = { success: false, error: stdout.trim() };
    }


  } catch (err: any) {
    // Catch any errors thrown during execution (e.g., from apiSwap if it throws)
    result = { success: false, error: err.message || String(err) };
    exitCode = 1;
  } finally {
      // Emit a single JSON blob on stdout
      console.log(JSON.stringify(result));
      process.exit(exitCode);
  }
})();
//hello