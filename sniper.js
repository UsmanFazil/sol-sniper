const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
require('dotenv').config();

const RAYDIUM_PUBLIC_KEY = process.env.RAYDIUM_PUBLIC_KEY;
const HTTP_URL = process.env.HTTP_URL;
const WSS_URL = process.env.WSS_URL;

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

async function fetchDecimals(mintAddress) {
    try {
        const tokenInfo = await connection.getTokenSupply(new PublicKey(mintAddress));
        return tokenInfo.value.decimals;
    } catch (error) {
        console.error("Error fetching decimals for", mintAddress, error);
        return null;
    }
}

async function fetchRaydiumMints(txId, connection) {
    try {
        const tx = await connection.getParsedTransaction(txId, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });

        if (!tx || !tx.transaction || !tx.transaction.message.instructions) {
            console.log("No transaction data found.");
            return;
        }

        const instruction = tx.transaction.message.instructions.find(ix => ix.programId.toBase58() === RAYDIUM_PUBLIC_KEY);
        if (!instruction || !instruction.accounts) {
            console.log("No matching instruction found in transaction.");
            return;
        }

        const baseMint = instruction.accounts[8]?.toBase58();
        const quoteMint = instruction.accounts[9]?.toBase58();
        const lpMint = instruction.accounts[10]?.toBase58() || "";

        if (!baseMint || !quoteMint) {
            console.log("Could not extract token mint addresses.");
            return;
        }

        const [baseDecimals, quoteDecimals, lpDecimals] = await Promise.all([
            fetchDecimals(baseMint),
            fetchDecimals(quoteMint),
            fetchDecimals(lpMint)
        ]);

        const newPair = {
            "official": [
                {
                    "id": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                    "baseMint": baseMint,
                    "quoteMint": quoteMint,
                    "lpMint": lpMint,
                    "baseDecimals": baseDecimals || 9,
                    "quoteDecimals": quoteDecimals || 6,
                    "lpDecimals": lpDecimals || 9,
                    "version": 4,
                    "programId": RAYDIUM_PUBLIC_KEY,
                    "authority": instruction.accounts[0]?.toBase58() || "",
                    "withdrawQueue": "11111111111111111111111111111111",
                    "lpVault": "11111111111111111111111111111111",
                    "marketVersion": 4,
                    "marketProgramId": "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX",
                    "marketId": instruction.accounts[1]?.toBase58() || "",
                    "marketAuthority": instruction.accounts[2]?.toBase58() || "",
                    "marketBaseVault": instruction.accounts[3]?.toBase58() || "",
                    "marketQuoteVault": instruction.accounts[4]?.toBase58() || "",
                    "marketBids": instruction.accounts[5]?.toBase58() || "",
                    "marketAsks": instruction.accounts[6]?.toBase58() || "",
                    "marketEventQueue": instruction.accounts[7]?.toBase58() || "",
                    "lookupTableAccount": instruction.accounts[11]?.toBase58() || "",
                    "openOrders": instruction.accounts[12]?.toBase58() || "",
                    "targetOrders": instruction.accounts[13]?.toBase58() || "",
                    "baseVault": instruction.accounts[14]?.toBase58() || "",
                    "quoteVault": instruction.accounts[15]?.toBase58() || ""
                }
            ]
        };

        console.log("New LP Found", newPair);
        saveToFile(newPair);
    } catch (error) {
        console.log("Error fetching transaction:", txId, error);
    }
}

function saveToFile(newData) {
    const filePath = "output.json";

    fs.readFile(filePath, "utf8", (err, fileData) => {
        let jsonArray = { "official": [] };

        if (!err && fileData) {
            try {
                jsonArray = JSON.parse(fileData);
                if (!jsonArray.official) {
                    jsonArray.official = [];
                }
            } catch (parseErr) {
                console.error("Error parsing JSON file:", parseErr);
            }
        }

        jsonArray.official.push(...newData.official);

        fs.writeFile(filePath, JSON.stringify(jsonArray, null, 2), (writeErr) => {
            if (writeErr) {
                console.error("Error writing to file:", writeErr);
            } else {
                console.log(`✅ New data appended to ${filePath}`);
            }
        });
    });
}

startConnection(connection, RAYDIUM, INSTRUCTION_NAME).catch(console.error);
