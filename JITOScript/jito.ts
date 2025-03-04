import { 
    QuoteGetRequest, 
    QuoteResponse, 
    createJupiterApiClient, 
    ResponseError, 
    SwapResponse 
} from '@jup-ag/api';
import { 
    Keypair, 
    LAMPORTS_PER_SOL, 
    Connection, 
    SystemProgram, 
    PublicKey, 
    Transaction, 
    VersionedTransaction 
} from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const CONFIG = {
    METIS_ENDPOINT: process.env.METIS_ENDPOINT || 'https://public.jupiterapi.com',
    JITO_ENDPOINT: process.env.JITO_ENDPOINT || '',
    WALLET_SECRET: process.env.WALLET_SECRET?.split(',').map(Number) || [],
    JITO_TIP_AMOUNT: 0.0005 * LAMPORTS_PER_SOL, // 500,000 lamports
    POLL_TIMEOUT_MS: 30000,
    POLL_INTERVAL_MS: 3000,
    DEFAULT_WAIT_BEFORE_POLL_MS: 5000
};

// Quote request configuration
const QUOTE_REQUEST: QuoteGetRequest = {
    inputMint: "So11111111111111111111111111111111111111112", // SOL
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    amount: LAMPORTS_PER_SOL / 1000, // 0.001 SOL
    restrictIntermediateTokens: true // https://station.jup.ag/docs/apis/landing-transactions#:~:text=()%3B-,restrictIntermediateTokens,-%3A%20Mkae%20sure%20that
};


interface BundleStatus {
    bundle_id: string;
    status: string;
    landed_slot?: number;
}

export class JitoSwapManager {
    private jupiterApi;
    private wallet: Keypair;
    private connection: Connection;

    constructor() {
        this.jupiterApi = createJupiterApiClient({ basePath: CONFIG.METIS_ENDPOINT });
        const secret = JSON.parse(process.env.WALLET_SECRET!);

        this.wallet = Keypair.fromSecretKey(new Uint8Array(secret));
        this.connection = new Connection(CONFIG.JITO_ENDPOINT);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getSwapQuote(inputMint:any, outputMint:any, amountLamports:any): Promise<QuoteResponse> {
      
     // Dynamically create the quote request
      const quoteRequest: QuoteGetRequest = {
        inputMint,
        outputMint,
        amount: amountLamports, 
        restrictIntermediateTokens: true, // restrictIntermediateTokens can be set to true . If your route is routed through random intermediate tokens, it will fail more frequently. With this, we make sure that your route is only routed through highly liquid intermediate tokens to give you the best price and more stable route.
      };
        const quote = await this.jupiterApi.quoteGet(quoteRequest);
        if (!quote) throw new Error('No quote found');
        return quote;
    }

    async getSwapTransaction(quote: QuoteResponse): Promise<SwapResponse> {
        const swapResult = await this.jupiterApi.swapPost({
            swapRequest: {
                quoteResponse: quote,
                userPublicKey: this.wallet.publicKey.toBase58(),
            },
        });
        if (!swapResult) throw new Error('No swap result found');
        return swapResult;
    }

    async createTipTransaction(jitoTipAccount: string): Promise<Transaction> {
        const tipTx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: this.wallet.publicKey,
                toPubkey: new PublicKey(jitoTipAccount),
                lamports: CONFIG.JITO_TIP_AMOUNT,
            })
        );
        tipTx.feePayer = this.wallet.publicKey;
        console.log("Creating Tip Tx");
        const conn = new Connection((process.env.JITO_ENDPOINTALTERNATIVE|| ''), {
            commitment: "confirmed", // Try "finalized" if you have issues
            disableRetryOnRateLimit: true, // Avoid retries if rate-limited
          });
        tipTx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
        tipTx.sign(this.wallet);
        return tipTx;
    }

    private convertBase64ToBase58(base64String: string): string {
        return bs58.encode(Buffer.from(base64String, 'base64'));
    }
      
      // Function to randomly select a tip account
    //   async getRandomTipAccount(network: "mainnet" | "testnet"): Promise<string> {
    //     const tipAccounts = network === "mainnet" ? TIP_ACCOUNTS_MAINNET : TIP_ACCOUNTS_TESTNET;
    //     return tipAccounts[Math.floor(Math.random() * tipAccounts.length)];
    //   }


    async getTipAccount(): Promise<string> {
        //@ts-ignore can use _rpcRequest
        const { result: tipAccounts } = await this.connection._rpcRequest("getTipAccounts", []);
        return tipAccounts[Math.floor(Math.random() * tipAccounts.length)];
    }

    async simulateTx(tx: VersionedTransaction, rpcUrl: string): Promise<boolean> {
        try {
            const connection = new Connection(rpcUrl, "confirmed"); // Use hardcoded RPC
            const result = await connection.simulateTransaction(tx);
            
            if (result.value.err) {
                console.error("Simulation failed:", result.value.logs);
                return false;
            }
            
            console.log("Simulation logs:", result.value.logs);
            return true;
        } catch (error) {
            console.error("Error during simulation:", error);
            return false;
        }
    }
    

    async simulateBundle(b64Transactions: string[]): Promise<void> {
        
        //@ts-ignore can use _rpcRequest
        const result = await this.connection._rpcRequest(
            "simulateBundle",
            [{ encodedTransactions: b64Transactions }]
        );
        if (result.error) throw new Error(`Simulation failed: ${result.error}`);
        return result;
    }

    async sendBundle(base58Transactions: string[]): Promise<string> {
        //@ts-ignore can use _rpcRequest
        const { result } = await this.connection._rpcRequest(
            "sendBundle",
            [base58Transactions]
        );
        return result;
    }

    async pollBundleStatus(bundleId: string): Promise<boolean> {
        await this.sleep(CONFIG.DEFAULT_WAIT_BEFORE_POLL_MS);

        const startTime = Date.now();
        let lastStatus = '';
        
        while (Date.now() - startTime < CONFIG.POLL_TIMEOUT_MS) {
            try {
                //@ts-ignore can use _rpcRequest
                const response = await this.connection._rpcRequest("getInflightBundleStatuses", [[bundleId]]);
                const bundleStatuses: BundleStatus[] = response.result.value;
                
                const status = bundleStatuses[0].status;
                if (status !== lastStatus) {
                    lastStatus = status;
                    console.log(`Bundle status: ${status}`);
                }

                if (status === 'Landed') {
                    console.log(`Bundle landed at slot: ${bundleStatuses[0].landed_slot}`);
                    return true;
                }

                if (status === 'Failed') {
                    throw new Error(`Bundle failed with status: ${status}`);
                }

                await new Promise(resolve => setTimeout(resolve, CONFIG.POLL_INTERVAL_MS));
            } catch (error) {
                console.error('Error polling bundle status:', error);
            }
        }
        throw new Error("Polling timeout reached without confirmation");
    }

    private async checkEnvironment(): Promise<void> {
        if (!CONFIG.WALLET_SECRET.length) {
            throw new Error('No wallet secret provided');
        }
        if (!CONFIG.JITO_ENDPOINT) {
            throw new Error('No Jito endpoint provided');
        }
    }

    async executeSwap(inputMint:any, outputMint:any, amountLamports:any): Promise<void> {
        try {
            // Code to Convert the string into a Uint8Array
            // const base58PrivateKey = "";
            // const privateKeyArray =  bs58.decode(base58PrivateKey);
            // console.log(`WALLET_SECRET=[${privateKeyArray.join(",")}]`);
            /////////////////////////////////////////////////////

            console.log("starting Swap", inputMint, ": and outputMint:", outputMint)
            await this.checkEnvironment();
            console.log(`Using Wallet: ${this.wallet.publicKey.toBase58()}`);
            
            // Get Jupiter quote and swap transaction
            console.log('Getting Swap Quote...');
            const quote = await this.getSwapQuote(inputMint, outputMint, amountLamports);
            const swapResult = await this.getSwapTransaction(quote);
            console.log(swapResult);

            // Process swap transaction
            const swapTxBuf = Buffer.from(swapResult.swapTransaction, 'base64');
            const swapVersionedTx = VersionedTransaction.deserialize(swapTxBuf);
            swapVersionedTx.sign([this.wallet]);

            // Convert swap transaction to required formats
            const serializedSwapTx = swapVersionedTx.serialize();

            const b64SwapTx = Buffer.from(serializedSwapTx).toString('base64');
            const b58SwapTx = this.convertBase64ToBase58(b64SwapTx);

            // Create and process tip transaction
            const jitoTipAccount = await this.getTipAccount();
            console.log(`Using JITO Tip Account: ${jitoTipAccount}`);
            const tipTx = await this.createTipTransaction(jitoTipAccount);
            const b64TipTx = tipTx.serialize().toString('base64');
            const b58TipTx = this.convertBase64ToBase58(b64TipTx);
            
            // Simulate and send bundle
            console.log("Simulating Bundle...");
            // depreciated
            // await this.simulateBundle([b64SwapTx, b64TipTx]);
            console.log('Simulation successful');
            const isSwapValid = await this.simulateTx(swapVersionedTx, (process.env.JITO_ENDPOINTALTERNATIVE|| ''));
            if (!isSwapValid) {
                console.log("Failed Simulation.", isSwapValid);
                return
            }
            console.log("Sending Bundle...");
            
            const bundleId = await this.sendBundle([b58SwapTx, b58TipTx]);
            console.log('This is your Bundle ID:', bundleId);
            
            await this.pollBundleStatus(bundleId);
            console.log(`Congratulations!!! Bundle landed successfully`);
            console.log(`https://explorer.jito.wtf/bundle/${bundleId}`);
        } catch (error) {
            if (error instanceof ResponseError) {
                console.error('API Error:', await error.response.json());
            } else {
                console.error('Error:', error);
            }
            throw error;
        }
    }
}
// const swapManager = new JitoSwapManager();
