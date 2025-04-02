"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const swapConfig_1 = require("./swapConfig");
function trimMainnetJson() {
    // Read the local mainnet.json file
    const mainnetData = JSON.parse(fs_1.default.readFileSync('../mainnet.json', 'utf-8'));
    // Get the token addresses from swapConfig
    const { tokenAAddress, tokenBAddress } = swapConfig_1.swapConfig;
    // Find the pool that matches the token pair in both official and unofficial pools
    const relevantPool = [...mainnetData.official, ...(mainnetData.unOfficial || [])].find((pool) => (pool.baseMint === tokenAAddress && pool.quoteMint === tokenBAddress) ||
        (pool.baseMint === tokenBAddress && pool.quoteMint === tokenAAddress));
    if (!relevantPool) {
        console.error('No matching pool found for the given token pair');
        return;
    }
    // Create a new object with only the necessary information
    const trimmedData = {
        official: [relevantPool]
    };
    // Write the trimmed data to a new file
    fs_1.default.writeFileSync('trimmed_mainnet.json', JSON.stringify(trimmedData, null, 2));
    console.log('Trimmed mainnet.json file has been created as trimmed_mainnet.json');
}
trimMainnetJson();
