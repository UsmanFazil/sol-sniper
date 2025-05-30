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
exports.apiSwap = void 0;
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var axios_1 = __importDefault(require("axios"));
var config_1 = require("../config");
var raydium_sdk_v2_1 = require("@raydium-io/raydium-sdk-v2");
var apiSwap = function (_a) {
    var _b = _a === void 0 ? {} : _a, inputMint = _b.inputMint, outputMint = _b.outputMint, _c = _b.amount, amount = _c === void 0 ? 0.01 * 1e9 : _c, _d = _b.slippage, slippage = _d === void 0 ? 0.5 : _d;
    return __awaiter(void 0, void 0, void 0, function () {
        var txVersion, isV0Tx, _e, isInputSol, isOutputSol, tokenAccounts, inputTokenAcc, outputTokenAcc, priorityFeeResp, swapResponse, txPayload, swapTransactions, allTxBuf, allTransactions, _f, blockhash, lastValidBlockHeight, idx, _i, allTransactions_1, tx, transaction, txId;
        var _g, _h, _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    txVersion = 'V0';
                    isV0Tx = txVersion === 'V0';
                    _e = [
                        inputMint === spl_token_1.NATIVE_MINT.toBase58(),
                        outputMint === spl_token_1.NATIVE_MINT.toBase58(),
                    ], isInputSol = _e[0], isOutputSol = _e[1];
                    return [4 /*yield*/, (0, config_1.fetchTokenAccountData)()];
                case 1:
                    tokenAccounts = (_m.sent()).tokenAccounts;
                    inputTokenAcc = (_g = tokenAccounts.find(function (a) { return a.mint.toBase58() === inputMint; })) === null || _g === void 0 ? void 0 : _g.publicKey;
                    outputTokenAcc = (_h = tokenAccounts.find(function (a) { return a.mint.toBase58() === outputMint; })) === null || _h === void 0 ? void 0 : _h.publicKey;
                    if (!inputTokenAcc && !isInputSol) {
                        console.error('❌ Missing input token account');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, axios_1.default.get("".concat(raydium_sdk_v2_1.API_URLS.BASE_HOST).concat(raydium_sdk_v2_1.API_URLS.PRIORITY_FEE))];
                case 2:
                    priorityFeeResp = (_m.sent()).data;
                    return [4 /*yield*/, axios_1.default.get("".concat(raydium_sdk_v2_1.API_URLS.SWAP_HOST, "/compute/swap-base-in?inputMint=").concat(inputMint, "&outputMint=").concat(outputMint, "&amount=").concat(amount, "&slippageBps=").concat(slippage * 100, "&txVersion=").concat(txVersion))];
                case 3:
                    swapResponse = (_m.sent()).data;
                    if (!((_k = (_j = swapResponse === null || swapResponse === void 0 ? void 0 : swapResponse.data) === null || _j === void 0 ? void 0 : _j.routePlan) === null || _k === void 0 ? void 0 : _k.length)) {
                        console.error('❌ No swap route found. Try increasing amount or check tokens.');
                        console.dir(swapResponse, { depth: null });
                        return [2 /*return*/];
                    }
                    console.log('✅ Swap quote:', {
                        outputAmount: swapResponse.data.outputAmount,
                        routePlan: swapResponse.data.routePlan.map(function (r) { return r.poolId; }),
                    });
                    txPayload = {
                        computeUnitPriceMicroLamports: String(priorityFeeResp.data.default.h),
                        swapResponse: swapResponse,
                        txVersion: txVersion,
                        wallet: config_1.owner.publicKey.toBase58(),
                        wrapSol: isInputSol,
                        unwrapSol: isOutputSol,
                        inputAccount: isInputSol ? undefined : inputTokenAcc === null || inputTokenAcc === void 0 ? void 0 : inputTokenAcc.toBase58(),
                        outputAccount: isOutputSol ? undefined : outputTokenAcc === null || outputTokenAcc === void 0 ? void 0 : outputTokenAcc.toBase58(),
                    };
                    console.log('📤 Sending transaction to Raydium...');
                    return [4 /*yield*/, axios_1.default.post("".concat(raydium_sdk_v2_1.API_URLS.SWAP_HOST, "/transaction/swap-base-in"), txPayload)];
                case 4:
                    swapTransactions = (_m.sent()).data;
                    if (!((_l = swapTransactions === null || swapTransactions === void 0 ? void 0 : swapTransactions.data) === null || _l === void 0 ? void 0 : _l.length)) {
                        console.error('❌ No transactions returned from Raydium API');
                        console.dir(swapTransactions, { depth: null });
                        return [2 /*return*/];
                    }
                    allTxBuf = swapTransactions.data.map(function (tx) { return Buffer.from(tx.transaction, 'base64'); });
                    allTransactions = allTxBuf.map(function (txBuf) {
                        return isV0Tx ? web3_js_1.VersionedTransaction.deserialize(txBuf) : web3_js_1.Transaction.from(txBuf);
                    });
                    console.log("\uD83D\uDD01 Executing ".concat(allTransactions.length, " transaction(s)..."));
                    return [4 /*yield*/, config_1.connection.getLatestBlockhash('finalized')];
                case 5:
                    _f = _m.sent(), blockhash = _f.blockhash, lastValidBlockHeight = _f.lastValidBlockHeight;
                    idx = 0;
                    _i = 0, allTransactions_1 = allTransactions;
                    _m.label = 6;
                case 6:
                    if (!(_i < allTransactions_1.length)) return [3 /*break*/, 10];
                    tx = allTransactions_1[_i];
                    idx++;
                    transaction = tx;
                    transaction.sign([config_1.owner]);
                    return [4 /*yield*/, config_1.connection.sendTransaction(transaction, { skipPreflight: true })];
                case 7:
                    txId = _m.sent();
                    console.log("\uD83D\uDD04 Sending v0 tx ".concat(idx, ": ").concat(txId));
                    return [4 /*yield*/, config_1.connection.confirmTransaction({
                            blockhash: blockhash,
                            lastValidBlockHeight: lastValidBlockHeight,
                            signature: txId,
                        }, 'confirmed')];
                case 8:
                    _m.sent();
                    console.log("\u2705 Confirmed v0 tx ".concat(idx));
                    _m.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 6];
                case 10: return [2 /*return*/];
            }
        });
    });
};
exports.apiSwap = apiSwap;
