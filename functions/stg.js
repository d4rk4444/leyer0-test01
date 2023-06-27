import { info,
    timeout,
    shuffle,
    numGenerate,
    parseFile,
    generateRandomAmount,
    privateToAddress } from '../tools/other.js';
import { checkAllowance,
    getETHAmount,
    getAmountToken,
    dataApprove,
    getGasPrice,
    sendEVMTX, 
    getDecimal } from '../tools/web3.js';
import { dataTraderJoeSwapETHToToken, dataTraderJoeSwapTokenToETH, dataUniSwapETHToToken, getAmountIn, getAmountInUniV3, getLBPair } from '../tools/DEXstg.js';
import { dataStakeSTG, getStakeTimeAmount } from '../tools/stargate.js';
import { subtract, multiply, divide, composition, add, to } from 'mathjs';
import { table } from 'table';
import fs from 'fs';
import consoleStamp from 'console-stamp';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { dataSpookySwapFTMToToken, dataSpookySwapTokenToFTM } from '../tools/spooky.js';
dotenv.config();

const output = fs.createWriteStream(`history.log`, { flags: 'a' });
const logger = new console.Console(output);
consoleStamp(console, { format: ':date(HH:MM:ss)' });
consoleStamp(logger, { format: ':date(yyyy/mm/dd HH:MM:ss)', stdout: output });

const pauseTime = generateRandomAmount(process.env.TIMEOUT_ACTION_SEC_MIN * 1000, process.env.TIMEOUT_ACTION_SEC_MAX * 1000, 0);
const slippage = generateRandomAmount(1 - process.env.SLIPPAGE_MIN / 100, 1 - process.env.SLIPPAGE_MAX / 100, 3);

export const swapETHToToken = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const random = generateRandomAmount(process.env.SWAP_PERCENT_MIN / 100, process.env.SWAP_PERCENT_MAX / 100, 3);

    const chains = ['Arbitrum', 'Avalanche', 'BSC'];
    const ticker = 'STG';
    const chain = chains[generateRandomAmount(0, chains.length - 1, 0)]
    const native = chain == 'Arbitrum' ? info.wETH
        : chain == 'Avalanche' ? info.wAVAX
        : chain == 'BSC' ? info.wBNB : false;
    const rpc = info['rpc' + chain];
    const token = info[ticker + chain];
    const tokenMid = chain == 'BSC' ? info.USDTBSC
        //: chain == 'Avalanche' ? info.USDCAvalanche
        : false;

    try {
        await getETHAmount(rpc, address).then(async(balanceETH) => {
            const amountETH = parseInt(multiply(balanceETH, random));
            console.log(`Swap ${parseFloat(amountETH/10**18).toFixed(4)}ETH for ${ticker} in ${chain}`);
            logger.log(`Swap ${parseFloat(amountETH/10**18).toFixed(4)}ETH for ${ticker} in ${chain}`);
            await dataTraderJoeSwapETHToToken(rpc, native, tokenMid, token, amountETH, address, slippage).then(async(res) => {
                await getGasPrice(rpc).then(async(gasPrice) => {
                    gasPrice = parseFloat(multiply(gasPrice, 1.2)).toFixed(4);
                    const typeTX = chain == 'Arbitrum' ? 2 : 0;
                    await sendEVMTX(rpc, typeTX, res.estimateGas, info.routerTraderJoe, amountETH, res.encodeABI, privateKey, gasPrice, gasPrice);
                });
            });
        });
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

export const swapETHToTokenOptimism = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const amountSTG = generateRandomAmount(process.env.SWAP_AMOUNT_MIN * 10**18, process.env.SWAP_AMOUNT_MAX * 10**18, 0);

    const ticker = 'STG';
    const chain = 'Optimism';
    const native = info.wETHOP;
    const rpc = info['rpc' + chain];
    const token = info[ticker + chain];

    try {
        await getAmountInUniV3(rpc, native, token, amountSTG, 1.01).then(async(amountETH) => {
            console.log(`Swap ${parseFloat(amountETH/10**18).toFixed(4)}ETH for ${ticker} in ${chain}`);
            logger.log(`Swap ${parseFloat(amountETH/10**18).toFixed(4)}ETH for ${ticker} in ${chain}`);
            await dataUniSwapETHToToken(rpc, native, token, amountETH, address, slippage).then(async(res) => {
                await getGasPrice(rpc).then(async(gasPrice) => {
                    gasPrice = parseFloat(multiply(gasPrice, 1.2)).toFixed(9);
                    await sendEVMTX(rpc, 0, res.estimateGas, info.uniswapRouter, amountETH, res.encodeABI, privateKey, gasPrice);
                });
            });
        });
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

export const swapETHToTokenAmount = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const amountSTG = generateRandomAmount(process.env.SWAP_AMOUNT_MIN * 10**18, process.env.SWAP_AMOUNT_MAX * 10**18, 0);

    const chains = ['Arbitrum'];
    const ticker = 'STG';
    const chain = chains[generateRandomAmount(0, chains.length - 1, 0)]
    const native = chain == 'Arbitrum' ? info.wETH
        : chain == 'Avalanche' ? info.wAVAX
        : chain == 'BSC' ? info.wBNB : false;
    const rpc = info['rpc' + chain];
    const token = info[ticker + chain];
    const tokenMid = chain == 'BSC' ? info.USDTBSC
        //: chain == 'Avalanche' ? info.USDCAvalanche
        : false;

    try {
        await getLBPair(rpc, native, token).then(async(addressLB) => {
            await getAmountIn(rpc, amountSTG, addressLB.LBPair, false, 1.02).then(async(amountIn) => {
                const amountETH = amountIn.amountIn;
                console.log(`Swap ${parseFloat(amountETH/10**18).toFixed(5)}ETH for ${ticker} in ${chain}`);
                logger.log(`Swap ${parseFloat(amountETH/10**18).toFixed(5)}ETH for ${ticker} in ${chain}`);
                await dataTraderJoeSwapETHToToken(rpc, native, tokenMid, token, amountETH, address, slippage).then(async(res) => {
                    await getGasPrice(rpc).then(async(gasPrice) => {
                        gasPrice = parseFloat(multiply(gasPrice, 1.2)).toFixed(4);
                        const typeTX = chain == 'Arbitrum' ? 2 : 0;
                        await sendEVMTX(rpc, typeTX, parseInt(res.estimateGas * 1.2), info.routerTraderJoe, amountETH, res.encodeABI, privateKey, gasPrice, gasPrice);
                    });
                });
            });
        });
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

export const checkStakeAmount = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const chains = ['Arbitrum', 'Avalanche', 'BSC'];

    try {
        const data = [['', 'Aviable', 'Stake', 'Date']];
        const arr= {
            Arbitrum: ['Arbitrum'],
            Avalanche: ['Avalanche'],
            BSC: ['BSC']
        };

        for (let i = 0; i < chains.length; i++) {
            const rpc = info['rpc' + chains[i]];
            const token = info['STG' + chains[i]];

            await getAmountToken(rpc, token, address).then(async(balanceSTG) => {
                await getDecimal(rpc, token).then(async(decimalSTG) => {
                    await getStakeTimeAmount(rpc, info['veSTG' + chains[i]], address).then(async(res) => {
                        const date = new Date(res.date * 1000);
                        let formattedDate = res.date == 0 ? '-' : `${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`;
                        arr[chains[i]].push((balanceSTG/10**decimalSTG).toFixed(2), (res.amount/10**decimalSTG).toFixed(2), formattedDate);
                        data.push(arr[chains[i]]);
                        //console.log(`${chains[i]}: Aviable STG: ${(balanceSTG/10**decimalSTG).toFixed(2)}       Stake STG: ${(res.amount/10**decimalSTG).toFixed(2)}        Data Unstake: ${formattedDate}`);
                    });
                });
            });
        }
        console.log(`\n${table(data)}`);
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

export const swapFTMToMIM = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const random = generateRandomAmount(process.env.SWAP_PERCENT_MIN / 100, process.env.SWAP_PERCENT_MAX / 100, 3);
    
    try {
        await getETHAmount(info.rpcFantom, address).then(async(balanceETH) => {
            const amountETH = parseInt(multiply(balanceETH, random));
            await dataSpookySwapFTMToToken(info.rpcFantom, info.WFTM, info.MIM, amountETH, address, slippage).then(async(res) => {
                await getGasPrice(info.rpcFantom).then(async(gasPrice) => {
                    gasPrice = parseFloat(multiply(gasPrice, 1.2)).toFixed(9);
                    await sendEVMTX(info.rpcFantom, 0, res.estimateGas, info.spookyRouter, amountETH, res.encodeABI, privateKey, gasPrice);
                    console.log(`Swap ${parseFloat(amountETH/10**18).toFixed(5)}FTM for MIM`);
                    logger.log(`Swap ${parseFloat(amountETH/10**18).toFixed(5)}FTM for MIM`);
                });
            });
        });
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

export const stakeSTG = async(privateKey) => {
    const address = privateToAddress(privateKey);

    const chains = ['Arbitrum', 'Avalanche', 'BSC', 'Optimism'];
    shuffle(chains);
    try {
        for (let i = 0; i < chains.length; i++) {
            let num = numGenerate();
            const timeStake = add(parseInt(Date.now() / 1000), process.env.LOCK_TIME * 86400);
            const rpc = info['rpc' + chains[i]];
            const token = info['STG' + chains[i]];
            const veSTG = info['veSTG' + chains[i]];
            await getAmountToken(rpc, token, address).then(async(balanceSTG) => {
                await getDecimal(rpc, token).then(async(decimal) => {
                    if (balanceSTG > 0) {
                        console.log(chalk.yellow(`Find ${(balanceSTG/10**decimal).toFixed(2)}STG in ${chains[i]}`));
                        logger.log(`Find ${(balanceSTG/10**decimal).toFixed(2)}STG in ${chains[i]}`);
                        await getGasPrice(rpc).then(async(gasPrice) => {
                            gasPrice = parseFloat(multiply(gasPrice, 1.2)).toFixed(9);
                            const typeTX = chains[i] == 'Arbitrum' ? 2 : 0;

                            await checkAllowance(rpc, token, address, veSTG).then(async(allowance) => {
                                if (Number(allowance) <= balanceSTG) {
                                    await dataApprove(rpc, token, veSTG, num, address).then(async(res) => {
                                        await sendEVMTX(rpc, typeTX, res.estimateGas, token, null, res.encodeABI, privateKey, gasPrice, gasPrice);
                                        console.log(chalk.green(`Successful Approve`));
                                        logger.log(`Successful Approve`);
                                    });
                                }
                            });
                            await timeout(pauseTime);

                            await dataStakeSTG(rpc, veSTG, balanceSTG, timeStake, address).then(async(res) => {
                                await sendEVMTX(rpc, typeTX, res.estimateGas, veSTG, null, res.encodeABI, privateKey, gasPrice, gasPrice);
                                console.log(chalk.green(`Successful Stake`));
                                logger.log(`Successful Stake`);
                                i = chains.length;
                            });
                        });
                    }
                });
            });
        }
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

export const swapMIMToFTM = async(privateKey) => {
    const address = privateToAddress(privateKey);
    
    try {
        await getAmountToken(info.rpcFantom, info.MIM, address).then(async(balanceToken) => {
            await getGasPrice(info.rpcFantom).then(async(gasPrice) => {
                gasPrice = parseFloat(multiply(gasPrice, 1.2)).toFixed(9);
                let num = numGenerate();
                await dataApprove(info.rpcFantom, info.MIM, info.spookyRouter, num, address).then(async(res) => {
                    await sendEVMTX(info.rpcFantom, 0, res.estimateGas, info.MIM, null, res.encodeABI, privateKey, gasPrice);
                    console.log(`Approve MIM`);
                    logger.log(`Approve MIM`);
                });
                await timeout(pauseTime);

                await dataSpookySwapTokenToFTM(info.rpcFantom, info.MIM, info.WFTM, balanceToken, address, slippage).then(async(res) => {
                    await sendEVMTX(info.rpcFantom, 0, res.estimateGas, info.spookyRouter, null, res.encodeABI, privateKey, gasPrice);
                    console.log(`Swap MIM for FTM`);
                    logger.log(`Swap MIM for FTM`);
                });
            });
        });
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}