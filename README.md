# Solana Wallet Token Monitor with Automated Sell Triggers

This project monitors a Solana wallet for token changes in real-time and provides automated sell triggers based on configurable conditions. It includes both a console-based monitor and a rich GUI interface for token tracking and trading.

## Features

### Core Functionality
- Real-time monitoring of token balance changes using Helius WebSocket API
- Detailed logging of token additions, removals, and balance changes
- Robust error handling and automatic reconnection

### Advanced GUI Features
- Interactive GUI for real-time token monitoring with detailed information
- Token value calculation in SOL using Jupiter API price quotes
- Time tracking for each token in the wallet
- Color-coded status indicators for tokens (Monitoring, SELLING, SOLD)

### Automated Sell Triggers
- **Time-Based Trigger**: Automatically sell tokens after they've been in the wallet for a specific duration (default: 120 seconds)
- **Take Profit Trigger**: Sell when a token's value increases by a set percentage from the initial investment (default: +200%)
- **Stop Loss Trigger**: Sell when a token's value decreases by a set percentage from the initial investment (default: -80%)

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Set up environment variables:
   ```
   # Windows PowerShell
   $env:SOLANA_WALLET_ADDRESS="your_wallet_address_here"
   $env:HELIUS_API_KEY="your_helius_api_key_here"
   
   # Windows Command Prompt
   set SOLANA_WALLET_ADDRESS=your_wallet_address_here
   set HELIUS_API_KEY=your_helius_api_key_here
   ```

   Alternatively, you can edit the scripts to directly include your wallet address and API key.

3. Run the application (choose one):
   - **Console Version**:
     ```
     python wallet_monitor.py
     ```
   - **GUI Version with Sell Triggers**:
     ```
     python tk_wallet_gui.py
     ```

## How It Works

### Console Monitor (wallet_monitor.py)
1. Establishes a WebSocket connection to Helius
2. Subscribes to your wallet account updates
3. Maintains a current state of tokens in your wallet
4. Detects and logs when tokens are added, removed, or have balance changes

### GUI Monitor with Sell Triggers (tk_wallet_gui.py)
1. Displays all tokens in your wallet with detailed information
2. Updates token prices in SOL every 0.5 seconds via Jupiter API
3. Tracks how long each token has been in your wallet
4. Monitors tokens for sell trigger conditions:
   - Sells tokens that have been in the wallet longer than 120 seconds
   - Sells tokens when they reach +200% profit compared to initial investment
   - Sells tokens when they drop to -80% loss compared to initial investment
5. Provides visual status updates for each token

## Customizing Sell Triggers

You can adjust the sell trigger parameters by modifying these variables in the `tk_wallet_gui.py` file:

```python
# Inside the WalletTokenGUI class:
self.initial_buy_amount = 0.05        # Initial investment amount in SOL
self.take_profit_percentage = 200     # +200% profit trigger
self.stop_loss_percentage = 80        # -80% loss trigger
self.time_based_trigger_seconds = 120 # 120 seconds time-based trigger
```

## Logging

Logs are output to both the console and log files:
- Console version: `wallet_monitor.log`
- GUI version: `wallet_gui.log`
