import { info,
    timeout,
    shuffle,
    parseFile,
    generateRandomAmount,
    privateToAddress } from './tools/other.js';
import { checkAllowance,
    getGasPriceEthereum,
    getETHAmount,
    getAmountToken,
    dataApprove,
    getGasPrice,
    sendArbitrumTX } from './tools/web3.js';
import { dataTraderSwapETHToToken, dataSpaceSwapTokenToETH  } from './tools/DEX.js';
import { subtract, multiply, divide, composition, add } from 'mathjs';
import fs from 'fs';
import readline from 'readline-sync';
import consoleStamp from 'console-stamp';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
dotenv.config();

const output = fs.createWriteStream(`history.log`, { flags: 'a' });
const logger = new console.Console(output);
consoleStamp(console, { format: ':date(HH:MM:ss)' });
consoleStamp(logger, { format: ':date(yyyy/mm/dd HH:MM:ss)', stdout: output });

const pauseTime = generateRandomAmount(process.env.TIMEOUT_ACTION_SEC_MIN * 1000, process.env.TIMEOUT_ACTION_SEC_MAX * 1000, 0);
const pauseWalletTime = generateRandomAmount(process.env.TIMEOUT_WALLET_SEC_MIN * 1000, process.env.TIMEOUT_WALLET_SEC_MAX * 1000, 0);
const slippage = generateRandomAmount(1 - process.env.SLIPPAGE_MIN / 100, 1 - process.env.SLIPPAGE_MAX / 100, 3);