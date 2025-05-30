#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var yargs_1 = __importDefault(require("yargs"));
var helpers_1 = require("yargs/helpers");
var swap_1 = require("../api/swap"); // Import the original apiSwap
// Function to capture console output
function captureConsole(callback) {
    var originalLog = console.log;
    var originalError = console.error;
    var stdout = '';
    var stderr = '';
    console.log = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        stdout += args.join(' ') + '\n';
    };
    console.error = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        stderr += args.join(' ') + '\n';
    };
    return callback().finally(function () {
        console.log = originalLog;
        console.error = originalError;
    }).then(function () { return ({ stdout: stdout, stderr: stderr }); });
}
// 1. Parse flags
var argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .strict()
    .option('inputMint', { type: 'string', demandOption: true, description: 'Input token mint address' })
    .option('outputMint', { type: 'string', demandOption: true, description: 'Output token mint address' })
    .option('amount', { type: 'number', demandOption: true, description: 'Amount of input token (in its smallest unit, e.g., lamports for SOL)' })
    .option('slippage', { type: 'number', default: 0.5, description: 'Slippage tolerance in percentage (e.g., 0.5 for 0.5%)' })
    .help()
    .parseSync();
// 2. Invoke apiSwap, capture output, and output JSON result
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var inputMint, outputMint, amount, slippage, result, exitCode, _a, stdout, stderr, txIdMatch, txIds, err_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                inputMint = argv.inputMint, outputMint = argv.outputMint, amount = argv.amount, slippage = argv.slippage;
                result = { success: false, error: 'An unexpected error occurred' };
                exitCode = 1;
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, 4, 5]);
                return [4 /*yield*/, captureConsole(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // Note: The original apiSwap expects amount in smallest units (like lamports)
                                // Ensure the 'amount' argument passed from Python is in the correct unit.
                                return [4 /*yield*/, (0, swap_1.apiSwap)({
                                        inputMint: inputMint,
                                        outputMint: outputMint,
                                        amount: amount, // Use the parsed amount directly
                                        slippage: slippage,
                                    })];
                                case 1:
                                    // Note: The original apiSwap expects amount in smallest units (like lamports)
                                    // Ensure the 'amount' argument passed from Python is in the correct unit.
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 2:
                _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                // Simple parsing based on expected console logs from the original apiSwap
                // This is fragile and depends on the exact log messages.
                if (stdout.includes('✅ Swap quote:') && stdout.includes('✅ Confirmed v0 tx')) {
                    txIdMatch = stdout.match(/🔄 Sending v0 tx \d+: (.*)/g);
                    txIds = txIdMatch ? txIdMatch.map(function (match) { return match.split(': ')[1]; }) : [];
                    result = { success: true, txIds: txIds.length > 0 ? txIds : undefined };
                    exitCode = 0;
                }
                else if (stderr.includes('❌ Missing input token account')) {
                    result = { success: false, error: 'Missing input token account' };
                }
                else if (stderr.includes('❌ No swap route found')) {
                    result = { success: false, error: 'No swap route found. Try increasing amount or check tokens.' };
                }
                else if (stderr.includes('❌ No transactions returned')) {
                    result = { success: false, error: 'No transactions returned from Raydium API' };
                }
                else if (stderr.length > 0) {
                    // Capture any other stderr as a generic error
                    result = { success: false, error: stderr.trim() };
                }
                else if (stdout.length > 0) {
                    // Capture any other stdout as a generic error if not a clear success
                    result = { success: false, error: stdout.trim() };
                }
                return [3 /*break*/, 5];
            case 3:
                err_1 = _b.sent();
                // Catch any errors thrown during execution (e.g., from apiSwap if it throws)
                result = { success: false, error: err_1.message || String(err_1) };
                exitCode = 1;
                return [3 /*break*/, 5];
            case 4:
                // Emit a single JSON blob on stdout
                console.log(JSON.stringify(result));
                process.exit(exitCode);
                return [7 /*endfinally*/];
            case 5: return [2 /*return*/];
        }
    });
}); })();
