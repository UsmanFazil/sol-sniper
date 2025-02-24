const { Connection, PublicKey } = require('@solana/web3.js');
require('dotenv').config()

const RAYDIUM_PUBLIC_KEY = process.env.RAYDIUM_PUBLIC_KEY;
const RAYDIUM_PUBLIC_KEY_DEVNET = process.env.RAYDIUM_PUBLIC_KEY_DEVNET;

const HTTP_URL = process.env.HTTP_URL; 
const HTTP_URL_DEVNET = process.env.HTTP_URL_DEVNET; 

const WSS_URL = process.env.WSS_URL; 
const WSS_URL_DEVNET = process.env.WSS_URL_DEVNET; 

const RAYDIUM = new PublicKey(RAYDIUM_PUBLIC_KEY || "");
const INSTRUCTION_NAME = "initialize2";

const connection = new Connection(HTTP_URL || "", {
    wsEndpoint: WSS_URL
});

async function startConnection(connection, programAddress, searchInstruction) {
    console.log("Monitoring logs for program:", programAddress.toString());
    connection.onLogs(
        programAddress,
        ({ logs, err, signature }) => {
            if (err) return;

            if (logs && logs.some(log => log.includes(searchInstruction))) {
                console.log("Signature for 'initialize2':", `https://explorer.solana.com/tx/${signature}`);
                fetchRaydiumMints(signature, connection);
            }
        },
        "finalized"
    );
}

async function fetchRaydiumMints(txId, connection) {
    try {
        const tx = await connection.getParsedTransaction(
            txId,
            {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            });

        const accounts = (tx?.transaction.message.instructions).find(ix => ix.programId.toBase58() === RAYDIUM_PUBLIC_KEY)?.accounts;
    
        if (!accounts) {
            console.log("No accounts found in the transaction.");
            return;
        }
    
        const tokenAIndex = 8;
        const tokenBIndex = 9;
    
        const tokenAAccount = accounts[tokenAIndex];
        const tokenBAccount = accounts[tokenBIndex];
    
        const displayData = 
            {  "inputMint":  tokenBAccount.toBase58(),
                "outputMint":  tokenAAccount.toBase58(),
                "amount": 1000000000,
                "slippageBps": 50,
                "priorityFee": 1000,
                "computeUnits": 400000,
                "jitoTip": 100000,
             }
        ;

        console.log("New LP Found");
        console.log(displayData);
    
    } catch (error) {
        console.log("Error fetching transaction:", txId, error);
        return;
    }
}

startConnection(connection, RAYDIUM, INSTRUCTION_NAME).catch(console.error);
