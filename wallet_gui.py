#!/usr/bin/env python3
"""
Wallet Token GUI Monitor
A standalone GUI to monitor tokens in a Solana wallet in real-time
"""

import json
import asyncio
import logging
import PySimpleGUI as sg
import httpx
from datetime import datetime
import threading
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("wallet_gui.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("wallet_gui")

class WalletTokenGUI:
    """GUI for displaying wallet tokens in real-time"""
    
    def __init__(self, wallet_address, helius_url):
        self.wallet_address = wallet_address
        self.helius_url = helius_url
        self.window = None
        self.token_data = {}
        self.token_metadata = {}
        self.running = True
        
    def create_window(self):
        """Create the GUI window"""
        sg.theme('DarkBlue')
        
        layout = [
            [sg.Text('Solana Wallet Token Monitor', font=('Helvetica', 16), justification='center', expand_x=True)],
            [sg.Text(f'Wallet: {self.wallet_address}', font=('Helvetica', 10))],
            [sg.Table(
                values=[],
                headings=['Token', 'Symbol', 'Balance', 'USD Value'],
                auto_size_columns=False,
                col_widths=[40, 10, 15, 12],
                justification='left',
                num_rows=15,
                key='-TOKEN_TABLE-',
                enable_events=True,
                expand_x=True,
                expand_y=True
            )],
            [sg.Text('Last updated: Never', key='-LAST_UPDATE-', font=('Helvetica', 9))],
            [sg.Text('Status: Initializing...', key='-STATUS-', text_color='yellow')],
            [sg.Button('Refresh Now', key='-REFRESH-'), sg.Button('Exit')]
        ]
        
        # Create the window with a fixed position to make it more visible
        self.window = sg.Window(
            'Solana Wallet Token Monitor',
            layout,
            size=(700, 500),
            resizable=True,
            finalize=True,
            keep_on_top=True,
            location=(100, 100)
        )
        
        logger.info("GUI window created successfully")
        return self.window
        
    async def fetch_token_accounts(self):
        """Fetch token accounts from the wallet"""
        try:
            self.window['-STATUS-'].update('Status: Fetching tokens...', text_color='blue')
            
            # Prepare the RPC request
            data = {
                "jsonrpc": "2.0",
                "id": "my-id",
                "method": "getTokenAccountsByOwner",
                "params": [
                    self.wallet_address,
                    {"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},
                    {"encoding": "jsonParsed"}
                ]
            }
            
            # Make the request
            async with httpx.AsyncClient() as client:
                response = await client.post(self.helius_url, json=data, timeout=30.0)
                response.raise_for_status()
                result = response.json().get("result", {})
                
                # Process the response
                new_tokens = {}
                if "value" in result:
                    for account in result["value"]:
                        try:
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
                                
                                # Fetch metadata if we don't have it yet
                                if mint not in self.token_metadata:
                                    metadata = await self.fetch_token_metadata(mint)
                                    self.token_metadata[mint] = metadata
                        except Exception as e:
                            logger.error(f"Error processing token account: {str(e)}")
                
                # Update the token data
                self.token_data = new_tokens
                
                # Update the GUI
                await self.update_token_table()
                self.window['-LAST_UPDATE-'].update(f'Last updated: {datetime.now().strftime("%H:%M:%S")}')
                self.window['-STATUS-'].update('Status: Connected', text_color='green')
                
                logger.info(f"Found {len(self.token_data)} tokens in wallet")
                return new_tokens
                
        except Exception as e:
            logger.error(f"Error fetching token accounts: {str(e)}")
            self.window['-STATUS-'].update(f'Status: Error - {str(e)}', text_color='red')
            return {}
            
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
                    'usd_value': 'N/A'
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
                'usd_value': 'N/A'
            }
    
    async def update_token_table(self):
        """Update the token table in the GUI"""
        try:
            # Prepare data for the table
            table_data = []
            for mint, token_data in self.token_data.items():
                metadata = self.token_metadata.get(mint, {})
                
                # Get token information, with fallbacks
                name = metadata.get('name', f"{mint[:6]}...{mint[-4:]}")
                symbol = metadata.get('symbol', '???')
                balance = f"{token_data['ui_amount']:.6f}"
                usd_value = metadata.get('usd_value', 'N/A')
                
                if usd_value != 'N/A':
                    usd_value = f"${usd_value:.2f}"
                    
                table_data.append([name, symbol, balance, usd_value])
            
            # Sort by name
            table_data.sort(key=lambda x: x[0])
            
            # Update the table
            if self.window:
                self.window['-TOKEN_TABLE-'].update(values=table_data)
                
        except Exception as e:
            logger.error(f"Error updating token table: {str(e)}")
            
    async def refresh_loop(self):
        """Refresh the token data periodically"""
        try:
            # Initial fetch
            await self.fetch_token_accounts()
            
            # Refresh every 10 seconds
            while self.running:
                await asyncio.sleep(10)
                if self.running:  # Check again after sleep
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
        
        # Main event loop
        try:
            while True:
                event, values = self.window.read(timeout=100)
                
                if event in (sg.WIN_CLOSED, 'Exit'):
                    break
                    
                if event == '-REFRESH-':
                    # Trigger an immediate refresh
                    asyncio.run(self.fetch_token_accounts())
                    
            # Cleanup
            self.running = False
            self.window.close()
            
        except Exception as e:
            logger.error(f"Error in GUI event loop: {str(e)}")
        finally:
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
