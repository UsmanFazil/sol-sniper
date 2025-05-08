const { exec } = require("child_process");

const jsonInput = JSON.stringify({ amount: 100, token: "USDT" });
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


async function fetchDecimals(mint) {
    try {
        const mintAccountInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
        const parsed = mintAccountInfo.value?.data?.parsed;

        if (
            mintAccountInfo.value?.owner?.toBase58() !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" ||
            parsed?.info?.decimals === undefined
        ) {
            throw new Error("Not a valid mint account");
        }

        return parsed.info.decimals;
    } catch (err) {
        console.error(`Error fetching decimals for ${mint}`, err);
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
    
    const accounts = instruction.accounts.map(account => account.toBase58());
    
    console.log("accounts:", accounts);
   
    const baseMint = accounts[9];
    const quoteMint = accounts[8];
    
    const lpMint = accounts[7];

    const lpDecimalss = await fetchDecimals(lpMint);

    const [baseDecimals, quoteDecimals] = await Promise.all([
        fetchDecimals(baseMint),
        fetchDecimals(quoteMint)    
    ]);

      
      const [authority] = await PublicKey.findProgramAddress(
        [Buffer.from("amm authority"), new PublicKey(accounts[4]).toBuffer()],
        new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8") // raydium amm program id
      );

      console.log("Pool ID (AMM ID):", accounts[4]);
      console.log("Base Mint:", baseMint);
      console.log("Quote Mint:", quoteMint);
      console.log("LP Mint:", lpMint);
      
      console.log("marketAuthority:", accounts[2]);
      console.log("marketBaseVault:", accounts[3]);
      console.log("marketQuoteVault:", accounts[4]);
      console.log("marketBids:", accounts[5]);
      console.log("marketAsks:", accounts[6]);
      console.log("marketEventQueue:", accounts[7]);
      
      console.log("baseVault:", accounts[14]);
      console.log("quoteVault:", accounts[15]);

    const newPair = {
        official: [
            {
                id: accounts[4],  // ✅ Pool address (Raydium AMM ID / main pool)
                baseMint,
                quoteMint,
                lpMint,
                baseDecimals: baseDecimals || 9,
                quoteDecimals: quoteDecimals || 6,
                lpDecimals: lpDecimalss || 9,
                version: 4,
                programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
                authority: authority,
                openOrders: accounts[6],
                targetOrders: "CZza3Ej4Mc58MnxWA385itCC9jCo3L1D7zc3LKy1bZMR",
                baseVault: accounts[14],
                quoteVault: accounts[18],       
                withdrawQueue: "11111111111111111111111111111111",
                lpVault: "11111111111111111111111111111111",
                marketVersion: 4,
                marketProgramId: "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX",
                marketId: "8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6",
                marketAuthority: "CTz5UMLQm2SRWHzQnU62Pi4yJqbNGjgRBHqqp6oDHfF7",
                marketBaseVault: "CKxTHwM9fPMRRvZmFnFoqKNd9pQR21c5Aq9bh5h9oghX",
                marketQuoteVault: "6A5NHCj1yF6urc9wZNe6Bcjj4LVszQNj5DwAWG97yzMu",
                marketBids: "5jWUncPNBMZJ3sTHKmMLszypVkoRK6bfEQMQUHweeQnh",
                marketAsks: "EaXdHx7x3mdGA38j5RSmKYSXMzAFzzUXCLNBEDXDn1d5",
                marketEventQueue: "8CvwxZ9Db6XbLD46NZwwmVDZZRDy7eydFcAGkXKh9axa",
                lookupTableAccount: "3q8sZGGpPESLxurJjNmr7s7wcKS5RPCCHMagbuHP9U2W"
                }
            ]
        };

        console.log("New LP Found", newPair);
        console.log("Executing command:", `npx ts-node ./src/index.ts '${JSON.stringify(newPair)}'`);
        var timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        //var timestamp = "1";

        var directory = "./LPJson"; // Change this to your desired directory
       var filePath = `${directory}/output_${timestamp}.json`;
       //var filePath = `${directory}/output_1.json`;

       //var filePath = `output_${timestamp}.json`;
       saveToFile(newPair, filePath);

        const jsonArg = `'${JSON.stringify(newPair).replace(/'/g, "\\'")}'`; 

        // Call it before the catch block
        var command = `npx ts-node ./src/index.ts '${baseMint}' '${quoteMint}' '${timestamp}'`;
        
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error is: ${error.message} ${stdout} ${stderr}`);
            return;
          }
          if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return;
          }
          console.log(`Output: ${stdout}`);
        });
    } catch (error) {
        console.log("Error fetching transaction:", txId, error);
    }
}


function saveToFile(newData,filePath) {

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


