
# 🚀 Raydium LP Listener Bot

This Node.js application listens for new liquidity pool (LP) pairs on the **Raydium protocol** on the Solana blockchain. It monitors transactions involving a specific instruction (`initialize2`) and logs LP token details in a structured JSON format.

---

## 📋 Features

- Monitors Raydium program logs in real-time.
- Detects new liquidity pool (LP) initialization events.
- Extracts and logs relevant transaction data:
  - `inputMint`
  - `outputMint`
  - Transaction amount
  - Slippage, priority fee, compute units, and Jito tip

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed on your system:

- [Node.js](https://nodejs.org/) (v20 or above)


---

## 📥 Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/UsmanFazil/sol-sniper.git
   cd sol-sniper
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Update the `.env` File if required:**

   Add your Solana network URLs and Raydium public keys in a `.env` file in the root directory

---

## 🚀 Running the Bot

### Monitor Raydium LP Events

1. **Start the Listener:**

   ```bash
   node sniper.js
   ```

2. **Expected Output:**

   When a new LP is detected, you'll see output similar to:

   ```json
   {
     "inputMint": "AddressOfTokenB",
     "outputMint": "AddressOfTokenA",
     "amount": 1000000000,
     "slippageBps": 50,
     "priorityFee": 1000,
     "computeUnits": 400000,
     "jitoTip": 100000
   }
   ```

3. **Transaction Link:**

   The terminal will also display a link to view the transaction on Solana Explorer:

   ```
   Signature for 'initialize2': https://explorer.solana.com/tx/YourTransactionSignature
   ```

---

## ⚙️ Project Structure

```
📦 sol-sniper
 ┣ 📜 sniper.js            # Main application file
 ┣ 📜 .env                 # Environment variables (Add your config here)
 ┣ 📜 package.json         # Project metadata and dependencies
 ┗ 📜 README.md            # Project documentation
```

---

Now you're ready to monitor Raydium LP events in real-time! 🚀
