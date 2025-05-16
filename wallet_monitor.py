#!/usr/bin/env python3
"""
Wallet Token Monitor Script
Monitors for tokens entering or leaving a Solana wallet using Helius WebSocket API
"""

import json
import asyncio
import logging
import websockets
from typing import Dict, Any, Optional, List
import httpx
import base58
import os
import threading
import PySimpleGUI as sg
from datetime import datetime

# Define PublicKey class since the solana module is having import issues
class PublicKey:
    """Custom implementation of Solana PublicKey"""
    def __init__(self, value):
        if isinstance(value, str):
            self._key = value
        else:
            raise ValueError(f"Invalid PublicKey input: {value}")
    
    def __str__(self):
        return self._key
    
    @property
    def key(self):
        return self._key

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("wallet_monitor.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("wallet_monitor")

# Custom AsyncClient implementation to avoid compatibility issues
class CustomAsyncClient:
    """
    Simplified AsyncClient that works with current httpx version
    Avoids proxy parameter issue in solana-py 0.36.6 and httpx 0.23.3
    """
    def __init__(self, endpoint: str, commitment: Optional[str] = None):
        self._endpoint = endpoint
        self._commitment = commitment
        self._request_id = 0
        self._client = httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        await self._client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def _make_request(self, method: str, params: Optional[List] = None) -> Dict[str, Any]:
        self._request_id += 1
        data = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method
        }
        if params is not None:
            data["params"] = params
        if self._commitment:
            if params is None:
                data["params"] = [{"commitment": self._commitment}]
            elif isinstance(params, list) and len(params) > 0 and isinstance(params[-1], dict):
                params[-1]["commitment"] = self._commitment
            else:
                data["params"] = [*params, {"commitment": self._commitment}]
        
        response = await self._client.post(self._endpoint, json=data)
        response.raise_for_status()
        result = response.json()
        
        if "error" in result:
            raise Exception(f"RPC Error: {result['error']}")
        
        return result.get("result")
    
    async def get_token_accounts_by_owner(self, owner: PublicKey, 
                                         program_id: str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"):
        """Get token accounts for a specific owner and program ID"""
        params = [
            str(owner),
            {"programId": program_id},
            {"encoding": "jsonParsed"}
        ]
        return await self._make_request("getTokenAccountsByOwner", params)


class WalletMonitor:
    """
    Monitor tokens entering and leaving a Solana wallet using Helius WebSocket API
    """
    def __init__(self, wallet_address: str):
        self.wallet_address = wallet_address
        # Use direct Helius URLs
        self.ws_url = "ADD WEBSOCKET ENDPOINT HERE"
        self.http_url = "ADD HTTP ENDPOINT HERE"
        self.client = None
        self.current_tokens = {}  # To keep track of current tokens in wallet
        self.token_metadata = {}  # To store token metadata
        self.ws = None
        self.window = None
        self.gui_update_event = asyncio.Event()
        
        # Start the GUI in a separate thread
        threading.Thread(target=self._start_gui, daemon=True).start()

    async def initialize(self):
        """Initialize the client and get current token state"""
        logger.info(f"Initializing wallet monitor for {self.wallet_address}")
        self.client = CustomAsyncClient(self.http_url)
        await self.update_current_tokens()

    def _start_gui(self):
        """Start the GUI in a separate thread"""
        try:
            logger.info("Starting GUI window...")
            # Set the theme
            sg.theme('DarkBlue')
            
            # Define the window layout
            layout = [
                [sg.Text('Wallet Token Monitor', font=('Helvetica', 16), justification='center', size=(40, 1))],
                [sg.Text(f'Wallet: {self.wallet_address}', font=('Helvetica', 10))],
                [sg.Table(
                    values=[],
                    headings=['Token', 'Symbol', 'Balance', 'USD Value'],
                    auto_size_columns=False,
                    col_widths=[35, 10, 15, 12],
                    justification='left',
                    num_rows=15,
                    key='-TOKEN_TABLE-',
                    enable_events=True,
                    expand_x=True,
                    expand_y=True
                )],
                [sg.Text('Last updated: Never', key='-LAST_UPDATE-', font=('Helvetica', 9))],
                [sg.Text('Status: Initializing...', key='-STATUS-', text_color='yellow')]
            ]
            
            # Create the window - force to front to make sure it's visible
            self.window = sg.Window('Wallet Token Monitor', 
                                   layout, 
                                   size=(600, 400), 
                                   resizable=True, 
                                   finalize=True,
                                   keep_on_top=True,  # Make sure window stays on top
                                   icon=None)
            
            logger.info("GUI window created successfully")
            
            # Immediately populate with any existing data
            if self.current_tokens:
                logger.info(f"Populating GUI with {len(self.current_tokens)} tokens")
                self._update_gui()
            
            # Start the event loop
            while True:
                event, values = self.window.read(timeout=100)
                
                if event == sg.WIN_CLOSED:
                    logger.info("GUI window closed by user")
                    break
                    
                # Check if there's a token update event
                if self.gui_update_event.is_set():
                    logger.info("Updating GUI with new token data")
                    self._update_gui()
                    self.gui_update_event.clear()
            
            self.window.close()
            logger.info("GUI window closed")
            
        except Exception as e:
            logger.error(f"Error in GUI thread: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
        
    def _update_gui(self):
        """Update the GUI with current token data"""
        try:
            if not self.window:
                return
                
            # Prepare data for the table
            table_data = []
            for mint, token_data in self.current_tokens.items():
                symbol = self.token_metadata.get(mint, {}).get('symbol', 'Unknown')
                name = self.token_metadata.get(mint, {}).get('name', mint[:8] + '...' + mint[-4:])
                balance = f"{token_data['ui_amount']:.6f}"
                usd_value = self.token_metadata.get(mint, {}).get('usd_value', 'N/A')
                if usd_value != 'N/A':
                    usd_value = f"${usd_value:.2f}"
                    
                table_data.append([name, symbol, balance, usd_value])
            
            # Sort by USD value if available, then by token name
            table_data.sort(key=lambda x: (x[3] if x[3] != 'N/A' else '0', x[0]))
            
            # Update the table
            self.window['-TOKEN_TABLE-'].update(values=table_data)
            
            # Update last updated time
            self.window['-LAST_UPDATE-'].update(f'Last updated: {datetime.now().strftime("%H:%M:%S")}')    
            
            # Update status
            self.window['-STATUS-'].update('Status: Connected', text_color='green')
            
        except Exception as e:
            logger.error(f"Error updating GUI: {str(e)}")
            if self.window:
                self.window['-STATUS-'].update(f'Status: Error - {str(e)}', text_color='red')
                
    async def fetch_token_metadata(self, token_mint):
        """Fetch token metadata from Helius API"""
        try:
            # Prepare the request to get token metadata
            method = "getAsset"
            params = {
                "id": token_mint,
                "displayOptions": {
                    "showUnverifiedCollections": True
                }
            }
            
            data = {
                "jsonrpc": "2.0",
                "id": "my-id",
                "method": method,
                "params": params
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(self.http_url, json=data, timeout=10.0)
                response.raise_for_status()
                result = response.json().get("result", {})
                
                metadata = {
                    'name': result.get('content', {}).get('metadata', {}).get('name', 'Unknown Token'),
                    'symbol': result.get('content', {}).get('metadata', {}).get('symbol', '???'),
                    'decimals': result.get('content', {}).get('metadata', {}).get('decimals', 0),
                    'usd_value': 'N/A'  # Could be updated with price data
                }
                
                self.token_metadata[token_mint] = metadata
                return metadata
                
        except Exception as e:
            logger.error(f"Error fetching token metadata for {token_mint}: {str(e)}")
            self.token_metadata[token_mint] = {
                'name': token_mint[:8] + '...' + token_mint[-4:],
                'symbol': '???',
                'decimals': 0,
                'usd_value': 'N/A'
            }
            return self.token_metadata[token_mint]
                
    async def update_current_tokens(self):
        """Get current tokens in the wallet and update the state"""
        try:
            wallet_pk = PublicKey(self.wallet_address)
            accounts = await self.client.get_token_accounts_by_owner(wallet_pk)
            
            # Reset current tokens
            new_tokens = {}
            
            if accounts and "value" in accounts:
                for account in accounts["value"]:
                    parsed_info = account["account"]["data"]["parsed"]["info"]
                    mint = parsed_info["mint"]
                    amount = int(parsed_info["tokenAmount"]["amount"])
                    decimals = parsed_info["tokenAmount"]["decimals"]
                    
                    if amount > 0:
                        new_tokens[mint] = {
                            "amount": amount,
                            "decimals": decimals,
                            "ui_amount": amount / (10 ** decimals)
                        }
                        
                        # Fetch metadata for new tokens
                        if mint not in self.token_metadata:
                            await self.fetch_token_metadata(mint)
            
            # Check for tokens that have been added or removed
            prev_tokens = set(self.current_tokens.keys())
            current_tokens = set(new_tokens.keys())
            
            # New tokens that weren't there before
            added_tokens = current_tokens - prev_tokens
            for token in added_tokens:
                await self.handle_token_added(token, new_tokens[token])
                
            # Tokens that are no longer there
            removed_tokens = prev_tokens - current_tokens
            for token in removed_tokens:
                await self.handle_token_removed(token, self.current_tokens[token])
                
            # Tokens with changed balances
            for token in prev_tokens.intersection(current_tokens):
                old_amount = self.current_tokens[token]["ui_amount"]
                new_amount = new_tokens[token]["ui_amount"]
                if old_amount != new_amount:
                    await self.handle_token_balance_changed(token, old_amount, new_amount)
            
            # Update current token state
            self.current_tokens = new_tokens
            
            # Signal the GUI thread to update
            self.gui_update_event.set()
            
        except Exception as e:
            logger.error(f"Error updating token accounts: {str(e)}")

    async def handle_token_added(self, token_mint: str, token_data: Dict):
        """Handle when a new token is added to the wallet"""
        logger.info(f"🟢 Token ADDED to wallet: {token_mint}, Amount: {token_data['ui_amount']}")
        # Additional handling like fetching token metadata could be added here

    async def handle_token_removed(self, token_mint: str, token_data: Dict):
        """Handle when a token is removed from the wallet"""
        logger.info(f"🔴 Token REMOVED from wallet: {token_mint}, Amount was: {token_data['ui_amount']}")

    async def handle_token_balance_changed(self, token_mint: str, old_amount: float, new_amount: float):
        """Handle when a token's balance changes"""
        change = new_amount - old_amount
        change_type = "increased" if change > 0 else "decreased"
        logger.info(f"📊 Token BALANCE CHANGED: {token_mint}, {change_type} by {abs(change)}, New amount: {new_amount}")

    async def subscribe_to_wallet(self):
        """Subscribe to wallet account updates using Helius WebSocket API"""
        if self.ws:
            await self.ws.close()
        
        self.ws = await websockets.connect(self.ws_url)
        
        # Subscribe to account updates for the wallet
        subscribe_message = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "accountSubscribe",
            "params": [
                self.wallet_address,
                {"encoding": "jsonParsed", "commitment": "confirmed"}
            ]
        }
        
        await self.ws.send(json.dumps(subscribe_message))
        response = await self.ws.recv()
        subscription_id = json.loads(response).get("result")
        logger.info(f"Successfully subscribed to wallet updates. Subscription ID: {subscription_id}")
        
        return subscription_id

    async def listen_for_updates(self):
        """Listen for WebSocket updates and process them"""
        try:
            subscription_id = await self.subscribe_to_wallet()
            
            logger.info("Listening for wallet updates...")
            while True:
                try:
                    message = await self.ws.recv()
                    data = json.loads(message)
                    
                    # Process the account update message
                    if "method" in data and data["method"] == "accountNotification":
                        # Update current tokens since we got a notification
                        await self.update_current_tokens()
                
                except websockets.exceptions.ConnectionClosed:
                    logger.warning("WebSocket connection closed. Reconnecting...")
                    subscription_id = await self.subscribe_to_wallet()
                    
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}")
                    await asyncio.sleep(1)
                    
        except Exception as e:
            logger.error(f"Error in WebSocket listener: {str(e)}")
            if self.ws:
                await self.ws.close()
            
            # After a short delay, try to reconnect
            await asyncio.sleep(5)
            await self.listen_for_updates()

    async def start(self):
        """Start the wallet monitoring process"""
        await self.initialize()
        await self.listen_for_updates()

    async def stop(self):
        """Stop the monitoring and close connections"""
        if self.ws:
            await self.ws.close()
        if self.client:
            await self.client.close()


async def main():
    """Main entry point for the script"""
    # Use the specified wallet address
    wallet_address = "ADD WALLET TO MONITOR HERE"
    logger.info(f"Starting monitoring for wallet: {wallet_address}")
    
    # Create and start the wallet monitor with direct URLs
    monitor = WalletMonitor(wallet_address)
    try:
        await monitor.start()
    except KeyboardInterrupt:
        logger.info("Shutting down due to keyboard interrupt")
        await monitor.stop()
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        await monitor.stop()


if __name__ == "__main__":
    asyncio.run(main())
