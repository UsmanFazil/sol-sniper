#!/usr/bin/env python3
"""
Solana Wallet Token Monitor with Automated Sell Triggers
=======================================================

A real-time Solana wallet monitoring tool that:
1. Displays all tokens in a wallet with up-to-the-second updates
2. Calculates current value of tokens in SOL
3. Tracks how long each token has been in the wallet
4. Implements automated sell triggers based on:
   - Time in wallet (sells after 120 seconds by default)
   - Take profit (sells when profit reaches +200% by default)
   - Stop loss (sells when loss reaches -80% by default)

This tool uses:
- Tkinter for the GUI interface
- Helius API for wallet and token data
- Jupiter API for price quotes and (simulated) token swaps
- Fast refresh (0.5s) with color indicators for status
"""

# Standard library imports
import json
import asyncio
import logging
import tkinter as tk
from tkinter import ttk
import threading
import os
import time
from datetime import datetime, timedelta
from decimal import Decimal

# Third-party imports
import httpx  # Modern HTTP client with async support

# Configure logging system for both console and file output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("wallet_gui.log"),  # Save logs to file
        logging.StreamHandler()                   # Display logs in console
    ]
)
logger = logging.getLogger("wallet_gui")

class WalletTokenGUI:
    """
    Main class for the Solana wallet token monitoring and automated trading tool.
    
    This class handles:
    1. Real-time wallet monitoring via Helius API
    2. Token price discovery via Jupiter API
    3. Graphical display of tokens and their status
    4. Automated sell trigger logic for take profit, stop loss, and time-based selling
    5. Transaction execution (simulated in this version)
    """
    
    def __init__(self, wallet_address, helius_url):
        """
        Initialize the wallet monitoring system with the specified wallet address and API endpoints.
        
        Args:
            wallet_address (str): The Solana wallet address to monitor
            helius_url (str): The Helius API URL with API key
        """
        # Core connection parameters
        self.wallet_address = wallet_address            # Wallet to monitor
        self.helius_url = helius_url                    # Helius API endpoint
        self.jupiter_url = "https://quote-api.jup.ag/v6" # Jupiter API endpoint for price discovery
        
        # GUI components (initialized later)
        self.root = None                # Main Tkinter window
        self.tree = None                # Treeview widget for token display
        self.status_label = None        # Status bar label
        self.last_update_label = None   # Last update time label
        
        # Token data storage
        self.token_data = {}            # Current token balances and data
        self.token_metadata = {}        # Token metadata (name, symbol, etc.)
        self.token_prices = {}          # Current token prices in SOL
        self.token_entry_times = {}     # When each token was first detected (timestamp)
        
        # Runtime control
        self.refresh_interval = 0.5     # Refresh wallet data every 0.5 seconds for ultra-fast updates
        self.running = True             # Control flag for main loop
        self.api_call_count = 0         # Track API calls for rate limiting awareness
        
        # ====== SELL TRIGGER CONFIGURATION ======
        # Initial investment amount - profit/loss is calculated relative to this amount
        self.initial_buy_amount = 0.05        # Initial buy amount in SOL (adjustable)
        
        # Profit-based trigger - sell when profit exceeds this percentage
        self.take_profit_percentage = 200     # +200% profit trigger
        
        # Loss-based trigger - sell when loss exceeds this percentage
        self.stop_loss_percentage = 80        # -80% loss trigger
        
        # Time-based trigger - sell after token has been in wallet for this many seconds
        self.time_based_trigger_seconds = 120 # 120 seconds time-based trigger
        
        # ====== TRACKING FOR TOKEN PRICES AND SELL STATUS ======
        self.token_initial_prices = {}   # Tracks price when token first detected
        self.token_initial_amounts = {}  # Tracks amount when token first detected
        self.tokens_sold = set()         # Set of tokens that have been sold
        self.pending_sells = set()       # Set of tokens currently being sold
        
        # Native SOL token mint address (used for price conversions)
        self.SOL_MINT = "So11111111111111111111111111111111111111112"
        
    def create_window(self):
        """
        Create and configure the main GUI window with all necessary components.
        
        This method sets up:
        1. The main Tkinter window with appropriate size and title
        2. A Treeview component to display token information in columns
        3. Status bar and control buttons
        4. Event handlers for window closing and button actions
        """
        # Create the main window with wallet address in title
        self.root = tk.Tk()
        self.root.title(f"Solana Wallet Token Monitor - {self.wallet_address[:8]}...")
        self.root.geometry("1200x600")  # Set initial window size
        
        # Main frame to contain all elements
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title and wallet information
        title_frame = ttk.Frame(main_frame)
        title_frame.pack(fill=tk.X, pady=(0, 10))
        
        title_label = ttk.Label(
            title_frame, 
            text="Solana Wallet Token Monitor", 
            font=("Helvetica", 16)
        )
        title_label.pack(side=tk.LEFT, pady=5)
        
        wallet_label = ttk.Label(
            title_frame,
            text=f"Wallet: {self.wallet_address}",
            font=("Helvetica", 10)
        )
        wallet_label.pack(side=tk.RIGHT, pady=5)
        
        # ====== TREEVIEW SETUP ======
        # Define the columns for token data display
        columns = ("mint", "name", "symbol", "amount", "sol_value", "entry_time", "status")
        
        # Create Treeview widget
        self.tree = ttk.Treeview(main_frame, columns=columns, show="headings")
        
        # Configure column headings
        self.tree.heading("mint", text="Mint Address")
        self.tree.heading("name", text="Name")
        self.tree.heading("symbol", text="Symbol")
        self.tree.heading("amount", text="Amount")
        self.tree.heading("sol_value", text="SOL Value")
        self.tree.heading("entry_time", text="Time in Wallet")
        self.tree.heading("status", text="Status")
        
        # Configure column widths
        self.tree.column("mint", width=250)     # Mint addresses are long
        self.tree.column("name", width=200)     # Names can be variable length
        self.tree.column("symbol", width=80)    # Symbols are usually short
        self.tree.column("amount", width=120)   # Balance amounts
        self.tree.column("sol_value", width=120) # SOL value with decimal places
        self.tree.column("entry_time", width=120) # Time display (e.g., "2m 35s")
        self.tree.column("status", width=100)   # Status indicators
        
        # Add scrollbar for the Treeview
        tree_scroll = ttk.Scrollbar(main_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=tree_scroll.set)
        
        # Position tree and scrollbar
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # ====== CONTROL BUTTONS ======
        button_frame = ttk.Frame(self.root)
        button_frame.pack(fill=tk.X, padx=10, pady=5)
        
        # Refresh button - manually trigger refresh
        refresh_button = ttk.Button(
            button_frame,
            text="Refresh Now",
            command=self.manual_refresh
        )
        refresh_button.pack(side=tk.LEFT, padx=5)
        
        # Exit button - close application gracefully
        exit_button = ttk.Button(
            button_frame,
            text="Exit",
            command=self.on_closing
        )
        exit_button.pack(side=tk.RIGHT, padx=5)
        
        # ====== STATUS BAR ======
        status_frame = ttk.Frame(self.root)
        status_frame.pack(fill=tk.X, padx=10, pady=5)
        
        # Status label - shows current operation state
        self.status_label = ttk.Label(status_frame, text="Initializing...")
        self.status_label.pack(side=tk.LEFT)
        
        # Last update timestamp
        self.last_update_label = ttk.Label(status_frame, text="")
        self.last_update_label.pack(side=tk.RIGHT)
        
        logger.info("GUI window created successfully")
        
    def on_closing(self):
        """
        Handle application shutdown when the window is closed.
        This method ensures clean termination by:
        1. Setting the running flag to False to stop background threads
        2. Logging the shutdown event
        3. Destroying the Tkinter root window
        """
        logger.info("Exiting application")
        # Signal all threads to stop processing
        self.running = False
        # Destroy the GUI window
        self.root.destroy()
        
    def manual_refresh(self):
        """Manually trigger a refresh"""
        threading.Thread(
            target=lambda: asyncio.run(self.fetch_token_accounts()),
            daemon=True
        ).start()
        
    def update_status(self, message, color="black"):
        """Update the status label"""
        if self.status_label:
            self.status_label.config(text=f"Status: {message}", foreground=color)
            
    def update_last_update(self):
        """Update the last update label"""
        if self.last_update_label:
            self.last_update_label.config(text=f"Last updated: {datetime.now().strftime('%H:%M:%S')}")
            
    async def fetch_token_accounts(self):
        """
        Fetch all token accounts owned by the wallet address and process their data.
        
        This is the core data collection method that:
        1. Queries the Solana blockchain via Helius RPC API for all token accounts
        2. Processes each token's data (mint, amount, decimals)
        3. Detects new tokens and records their entry time
        4. Updates token prices in SOL via Jupiter API
        5. Checks sell triggers for each token
        6. Updates the GUI with fresh data
        
        Returns:
            dict: A dictionary of token data keyed by mint address
        """
        try:
            # Update the status to indicate we're fetching data
            self.update_status("Fetching tokens...", "blue")
            
            # ====== PREPARE SOLANA RPC REQUEST ======
            # Standard Solana JSON-RPC request to get all token accounts owned by the wallet
            data = {
                "jsonrpc": "2.0",
                "id": "my-id",
                "method": "getTokenAccountsByOwner",  # Solana RPC method to get token accounts
                "params": [
                    self.wallet_address,                                     # The wallet to fetch tokens from
                    {"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"}, # Solana Token Program ID
                    {"encoding": "jsonParsed"}                                 # Request parsed data for easier processing
                ]
            }
            
            # ====== EXECUTE RPC REQUEST ======
            # Use httpx for async HTTP requests to the Helius API endpoint
            async with httpx.AsyncClient() as client:
                # Make the POST request to the Helius API
                response = await client.post(self.helius_url, json=data, timeout=30.0)
                response.raise_for_status()  # Raise exception for HTTP errors
                result = response.json().get("result", {})
                
                # ====== PROCESS TOKEN ACCOUNTS ======
                new_tokens = {}            # Will hold all current tokens
                current_time = time.time() # Current timestamp for entry time tracking
                
                if "value" in result:
                    # Iterate through each token account returned
                    for account in result["value"]:
                        try:
                            # Extract token information from the parsed data
                            parsed_info = account["account"]["data"]["parsed"]["info"]
                            mint = parsed_info["mint"]                          # Token mint address
                            amount = int(parsed_info["tokenAmount"]["amount"])   # Raw token amount
                            decimals = parsed_info["tokenAmount"]["decimals"]    # Token decimals
                            
                            # Only process tokens with non-zero balance
                            if amount > 0:
                                # Store token data
                                new_tokens[mint] = {
                                    "amount": amount,                    # Raw token amount
                                    "decimals": decimals,               # Token decimal places
                                    "ui_amount": amount / (10 ** decimals) # Human-readable amount
                                }
                                
                                # ====== NEW TOKEN DETECTION ======
                                # If this is a new token we haven't seen before, record its entry time
                                if mint not in self.token_data and mint not in self.token_entry_times:
                                    logger.info(f"New token detected: {mint}")
                                    self.token_entry_times[mint] = current_time
                                
                                # ====== METADATA FETCHING ======
                                # If we don't have metadata for this token yet, fetch it
                                if mint not in self.token_metadata:
                                    metadata = await self.fetch_token_metadata(mint)
                                    self.token_metadata[mint] = metadata
                        except Exception as e:
                            logger.error(f"Error processing token account: {str(e)}")
                
                # Update our main token data storage with the newly fetched data
                self.token_data = new_tokens
                
                # ====== TOKEN PRICE UPDATES AND SELL TRIGGER CHECKS ======
                # For each token, get its current SOL value and check sell triggers
                for mint in self.token_data.keys():
                    try:
                        # Skip processing tokens that have already been sold or are being sold
                        if mint in self.tokens_sold or mint in self.pending_sells:
                            continue
                            
                        # ====== PRICE DISCOVERY ======
                        # Get fresh SOL price for this token using Jupiter API
                        sol_price = await self.get_token_price_in_sol(mint)
                        
                        # Update the token's metadata with the fresh price
                        if mint in self.token_metadata:
                            self.token_metadata[mint]["sol_value"] = sol_price
                        
                        # ====== INITIAL PRICE RECORDING ======
                        # If this is the first valid price we've seen for this token, record it
                        if mint not in self.token_initial_prices and sol_price != 0.0 and sol_price != "N/A":
                            # Store the initial price and amount for future profit calculations
                            self.token_initial_prices[mint] = sol_price
                            self.token_initial_amounts[mint] = self.token_data[mint]["ui_amount"]
                            logger.info(f"Recorded initial price for {mint}: {sol_price} SOL")
                        
                        # ====== SELL TRIGGER CHECK ======
                        # Check if any sell conditions are met for this token
                        if mint in self.token_initial_prices and mint not in self.pending_sells:
                            await self.check_sell_triggers(mint, sol_price)
                        
                    except Exception as e:
                        logger.error(f"Error updating SOL price for {mint}: {str(e)}")
                
                # ====== GUI UPDATES ======
                # Schedule GUI updates to happen on the main thread
                # Use after(0, ...) to schedule for the next event loop iteration
                self.root.after(0, self.update_token_tree)       # Update the token display
                self.root.after(0, self.update_last_update)      # Update the timestamp
                self.root.after(0, lambda: self.update_status(
                    f"Connected - {self.api_call_count} API calls", "green")) # Update status
                
                # Log the number of tokens found
                logger.info(f"Found {len(self.token_data)} tokens in wallet")
                return new_tokens
                
        except Exception as e:
            # Handle any errors in the main fetch process
            logger.error(f"Error fetching token accounts: {str(e)}")
            self.root.after(0, lambda: self.update_status(f"Error: {str(e)}", "red"))
            return {}
            
    async def get_token_price_in_sol(self, token_mint, amount=1.0):
        """Get token price in SOL using Jupiter quote API - fetching fresh data every time"""
        try:
            # Skip if trying to get SOL price in SOL
            if token_mint == self.SOL_MINT:
                return 1.0  # 1 SOL = 1 SOL
                
            # Cache key for this token
            cache_key = f"{token_mint}_sol"
                
            # Prepare request to Jupiter API
            # Following the Jupiter API V6 structure from docs
            params = {
                "inputMint": token_mint,
                "outputMint": self.SOL_MINT,
                "amount": str(int(amount * 10**9)),  # Convert to lamports (SOL has 9 decimals)
                "slippageBps": 50  # 0.5% slippage
            }
            
            url = f"{self.jupiter_url}/quote"
            
            # Track API calls
            self.api_call_count += 1
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=15.0)
                response.raise_for_status()
                result = response.json()
                
                # Extract the price
                if result and "outAmount" in result:
                    # Calculate the price from the quote
                    in_amount = Decimal(result.get("inAmount", "0"))
                    out_amount = Decimal(result.get("outAmount", "0"))
                    
                    if in_amount and in_amount > 0:
                        # We're getting price for 1 token in SOL
                        # (out_amount / 10^9) / (in_amount / 10^token_decimals)
                        price_in_sol = (out_amount / Decimal(10**9)) / (Decimal(1.0))
                        
                        # Update the price
                        self.token_prices[cache_key] = float(price_in_sol)
                        return float(price_in_sol)
                    
            # If we reach here, couldn't get a valid price
            # Return previous price if available
            return self.token_prices.get(cache_key, 0.0)  
            
        except Exception as e:
            logger.error(f"Error getting token price for {token_mint}: {str(e)}")
            # Return previous price if available
            return self.token_prices.get(cache_key, 0.0)
            
    async def fetch_token_metadata(self, token_mint):
        """Fetch token metadata from Helius API"""
        try:
            # Prepare the request to get token metadata
            data = {
                "jsonrpc": "2.0",
                "id": "my-id",
                "method": "getAsset",
                "params": {
                    "id": token_mint,
                    "displayOptions": {
                        "showUnverifiedCollections": True
                    }
                }
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(self.helius_url, json=data, timeout=10.0)
                response.raise_for_status()
                result = response.json().get("result", {})
                
                content = result.get('content', {})
                metadata = content.get('metadata', {})
                
                token_info = {
                    'name': metadata.get('name', 'Unknown Token'),
                    'symbol': metadata.get('symbol', '???'),
                    'decimals': metadata.get('decimals', 0),
                    'sol_value': 'N/A'  # Will be updated on each refresh
                }
                
                # If the token name is missing, use part of the mint address
                if not token_info['name'] or token_info['name'] == 'Unknown Token':
                    token_info['name'] = f"{token_mint[:6]}...{token_mint[-4:]}"
                
                return token_info
                
        except Exception as e:
            logger.error(f"Error fetching token metadata for {token_mint}: {str(e)}")
            return {
                'name': f"{token_mint[:6]}...{token_mint[-4:]}",
                'symbol': '???',
                'decimals': 0,
                'sol_value': 'N/A'
            }
    
    def update_token_tree(self):
        """Update the token tree in the GUI"""
        try:
            # Clear existing items
            for item in self.tree.get_children():
                self.tree.delete(item)
            
            current_time = time.time()
                
            # Add tokens to the tree
            token_rows = []
            for mint, token_data in self.token_data.items():
                metadata = self.token_metadata.get(mint, {})
                
                # Get token information, with fallbacks
                name = metadata.get('name', f"{mint[:6]}...{mint[-4:]}")
                symbol = metadata.get('symbol', '???')
                balance = token_data['ui_amount']
                balance_str = f"{balance:.6f}"
                
                # Get SOL value - both per token and total
                sol_value_per_token = metadata.get('sol_value', 'N/A')
                
                if sol_value_per_token != 'N/A':
                    # Calculate total value in SOL
                    total_sol_value = balance * float(sol_value_per_token)
                    sol_value_str = f"{total_sol_value:.4f} ◎"
                else:
                    sol_value_str = 'N/A'
                
                # Calculate time in wallet
                entry_time = self.token_entry_times.get(mint, current_time)
                seconds_in_wallet = int(current_time - entry_time)
                
                # Format the time in wallet
                if seconds_in_wallet < 60:
                    time_in_wallet_str = f"{seconds_in_wallet}s"
                elif seconds_in_wallet < 3600:
                    minutes = seconds_in_wallet // 60
                    seconds = seconds_in_wallet % 60
                    time_in_wallet_str = f"{minutes}m {seconds}s"
                elif seconds_in_wallet < 86400:  # less than a day
                    hours = seconds_in_wallet // 3600
                    minutes = (seconds_in_wallet % 3600) // 60
                    time_in_wallet_str = f"{hours}h {minutes}m"
                else:
                    days = seconds_in_wallet // 86400
                    hours = (seconds_in_wallet % 86400) // 3600
                    time_in_wallet_str = f"{days}d {hours}h"
                    
                # Get sell trigger status
                status = "Monitoring"
                status_color = "black"
                
                if mint in self.tokens_sold:
                    status = "SOLD"
                    status_color = "green"
                elif mint in self.pending_sells:
                    status = "SELLING"
                    status_color = "blue"
                elif mint in self.token_initial_prices:
                    # Check how close we are to triggers
                    initial_price = self.token_initial_prices.get(mint, 0)
                    if initial_price > 0 and sol_value_per_token != 'N/A':
                        # Current value of investment
                        current_value = balance * sol_value_per_token
                        
                        # Initial investment was self.initial_buy_amount SOL
                        initial_investment = self.initial_buy_amount
                        
                        # Calculate profit/loss percentage based on initial investment
                        # (current_value - initial_investment) / initial_investment * 100
                        profit_loss_pct = ((current_value - initial_investment) / initial_investment) * 100
                        
                        # Time trigger check
                        time_trigger_pct = (seconds_in_wallet / self.time_based_trigger_seconds) * 100
                        
                        if profit_loss_pct >= 0:  # Profit scenario
                            status = f"+{profit_loss_pct:.1f}% profit"
                            # Closer to take profit = more yellow
                            if profit_loss_pct >= self.take_profit_percentage * 0.8:
                                status_color = "orange"
                        else:  # Loss scenario
                            loss_pct = abs(profit_loss_pct)
                            status = f"-{loss_pct:.1f}% loss"
                            # Closer to stop loss = more red
                            if loss_pct >= self.stop_loss_percentage * 0.8:
                                status_color = "red"
                                
                        # Time trigger gets priority if closer
                        if time_trigger_pct >= 80 and time_trigger_pct < 100:
                            status = f"{int(self.time_based_trigger_seconds - seconds_in_wallet)}s to sell"
                            status_color = "purple"
                
                # Create row with status and sort key
                token_rows.append((name, symbol, balance_str, sol_value_str, time_in_wallet_str, status, 
                                  total_sol_value if sol_value_per_token != 'N/A' else 0, 
                                  status_color))
            
            # Sort by SOL value (descending)
            token_rows.sort(key=lambda x: x[6], reverse=True)
            
            # Insert into tree with status
            for row in token_rows:
                item_id = self.tree.insert("", tk.END, values=row[:6])
                
                # Apply color formatting based on status
                self.tree.item(item_id, tags=(row[7],))  # Use status_color as tag name
                
            # Configure tag colors
            self.tree.tag_configure("red", foreground="red")
            self.tree.tag_configure("green", foreground="green")
            self.tree.tag_configure("blue", foreground="blue")
            self.tree.tag_configure("orange", foreground="orange")
            self.tree.tag_configure("purple", foreground="purple")
                
        except Exception as e:
            logger.error(f"Error updating token tree: {str(e)}")
            
    async def check_sell_triggers(self, token_mint, current_price):
        """Check if any sell triggers have been activated for this token"""
        try:
            # Skip if this token is already sold or pending sale
            if token_mint in self.tokens_sold or token_mint in self.pending_sells:
                return
                
            current_time = time.time()
            entry_time = self.token_entry_times.get(token_mint, current_time)
            current_amount = self.token_data[token_mint]["ui_amount"]
            
            # Skip if we don't have price data
            if current_price <= 0:
                return
                
            # Current value of position in SOL
            current_value = current_amount * current_price
            
            # Initial investment was self.initial_buy_amount SOL
            initial_investment = self.initial_buy_amount
                
            # 1. Time-based trigger - Sell after X seconds in wallet
            time_in_wallet = current_time - entry_time
            if time_in_wallet >= self.time_based_trigger_seconds:
                reason = f"TIME-BASED TRIGGER: Token held for {int(time_in_wallet)} seconds"
                await self.sell_token(token_mint, current_price, current_amount, reason)
                return
                
            # 2. Take profit trigger - Sell when total position value increases by X% from initial investment
            profit_percentage = ((current_value - initial_investment) / initial_investment) * 100
            if profit_percentage >= self.take_profit_percentage:
                reason = f"TAKE PROFIT TRIGGER: +{profit_percentage:.1f}% profit reached"
                await self.sell_token(token_mint, current_price, current_amount, reason)
                return
            
            # 3. Stop loss trigger - Sell when total position value decreases by X% from initial investment
            if profit_percentage < 0:
                loss_percentage = abs(profit_percentage)
                if loss_percentage >= self.stop_loss_percentage:
                    reason = f"STOP LOSS TRIGGER: -{loss_percentage:.1f}% loss reached"
                    await self.sell_token(token_mint, current_price, current_amount, reason)
                    return
                    
        except Exception as e:
            logger.error(f"Error checking sell triggers for {token_mint}: {str(e)}")
    
    async def sell_token(self, token_mint, current_price, amount, reason):
        """Sell the specified token through Jupiter"""
        try:
            # Mark this token as pending sale to prevent duplicate sells
            self.pending_sells.add(token_mint)
            
            token_name = "Unknown"
            if token_mint in self.token_metadata:
                token_name = self.token_metadata[token_mint].get("name", token_mint[:8])
                
            # Calculate values based on our fixed initial investment
            current_value = amount * current_price
            initial_investment = self.initial_buy_amount
            
            profit_loss = current_value - initial_investment
            profit_loss_percentage = 0
            if initial_investment > 0:
                profit_loss_percentage = (profit_loss / initial_investment) * 100
                
            # Log the sell action with detailed information
            logger.info(f"===== SELLING TOKEN: {token_name} ({token_mint}) =====")
            logger.info(f"Reason: {reason}")
            logger.info(f"Amount: {amount} tokens")
            logger.info(f"Current price: {current_price} SOL per token")
            logger.info(f"Current value: {current_value} SOL")
            logger.info(f"Initial investment: {initial_investment} SOL")
            logger.info(f"Profit/Loss: {profit_loss:.6f} SOL ({profit_loss_percentage:.2f}%)")
            logger.info(f"Time in wallet: {int(time.time() - self.token_entry_times.get(token_mint, time.time()))} seconds")
            
            # In a real implementation, we would call Jupiter swap API here
            # For now, we'll simulate the sell with a delay
            
            # Update status
            message = f"SELLING: {token_name} - {reason}"
            self.root.after(0, lambda: self.update_status(message, "blue"))
            
            # Simulate API call delay
            await asyncio.sleep(2)
            
            # Mark as sold
            self.tokens_sold.add(token_mint)
            self.pending_sells.remove(token_mint)
            
            # Show success message
            message = f"SOLD: {token_name} - {reason}"
            self.root.after(0, lambda: self.update_status(message, "green"))
            
            return True
            
        except Exception as e:
            logger.error(f"Error selling token {token_mint}: {str(e)}")
            # Remove from pending to allow retry
            if token_mint in self.pending_sells:
                self.pending_sells.remove(token_mint)
            return False
    
    async def refresh_loop(self):
        """Refresh the token data periodically"""
        try:
            # Initial fetch
            await self.fetch_token_accounts()
            
            # Track time for resetting API counter
            last_counter_reset = time.time()
            
            # Refresh every 0.5 seconds
            while self.running:
                await asyncio.sleep(self.refresh_interval)  # 0.5 seconds
                if self.running:  # Check again after sleep
                    current_time = time.time()
                    
                    # Reset API call counter every minute for stats
                    if current_time - last_counter_reset > 60:
                        logger.info(f"API calls in the last minute: {self.api_call_count}")
                        self.api_call_count = 0
                        last_counter_reset = current_time
                        
                    # Get fresh data
                    await self.fetch_token_accounts()
                    
        except Exception as e:
            logger.error(f"Error in refresh loop: {str(e)}")
            
    def start(self):
        """Start the GUI and background refresh"""
        self.create_window()
        
        # Start the refresh loop in a separate thread
        refresh_thread = threading.Thread(
            target=lambda: asyncio.run(self.refresh_loop()),
            daemon=True
        )
        refresh_thread.start()
        
        # Start the Tkinter main loop
        self.root.mainloop()
        
        # Clean up
        self.running = False
        logger.info("GUI closed")

def main():
    """Main entry point"""
    wallet_address = "ADD WALLET TO MONITOR HERE"
    helius_url = "ADD ENDPOINTS HERE"
    
    logger.info(f"Starting wallet GUI monitor for {wallet_address}")
    
    gui = WalletTokenGUI(wallet_address, helius_url)
    gui.start()

if __name__ == "__main__":
    main()
