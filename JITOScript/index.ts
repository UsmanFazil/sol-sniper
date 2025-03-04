import fs from "fs-extra";
import path from "path";
import { JitoSwapManager } from "./jito"; // Import the class
// Define the interface for a swap
interface Swap {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  priorityFee: number;
  computeUnits: number;
  jitoTip: number;
  status?: string; // Optional status field
}

// Path to the JSON file
const filePath = path.join("./", "output.json");
// Create an instance of JitoSwapManager
const swapManager = new JitoSwapManager();

// Function to process swaps using JitoSwapManager
async function processSwap(swap: Swap): Promise<boolean> {
    try {
      console.log(`Processing swap: ${swap.inputMint} → ${swap.outputMint}`);
      await swapManager.executeSwap(swap.inputMint, swap.outputMint, swap.amount);
      return true;
    } catch (error) {
      console.error("Swap failed:", error);
      return false;
    }
  }
// Function to process swaps
async function executeSwaps(): Promise<void> {
  try {
    let swaps: Swap[] = await fs.readJson(filePath);

    for (let swap of swaps) {
      if (swap.status === "completed") {
        console.log(`Skipping completed swap: ${swap.inputMint} → ${swap.outputMint}`);
        continue;
      }
      console.log("\n\nTransaction Started"); // Adds two new lines before printing
      const success = await processSwap(swap);
      swap.status = success ? "completed" : "failed";

      await fs.writeJson(filePath, swaps, { spaces: 2 });
    }

    console.log("All swaps processed.");
  } catch (error) {
    console.error("Error processing swaps:", error);
  }
}

// Run the script
executeSwaps();
