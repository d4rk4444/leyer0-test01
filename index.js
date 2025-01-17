import { info,
    timeout,
    shuffle,
    parseFile,
    generateRandomAmount,
    privateToAddress, 
    privateToAptosAddress} from './tools/other.js';
import { checkAllowance,
    getETHAmount,
    getAmountToken,
    dataApprove,
    getGasPrice,
    sendEVMTX, 
    getTokenBalanceAptos,
    getAPTBalance} from './tools/web3.js';
import { dataTraderJoeSwapETHToToken, dataTraderJoeSwapTokenToETH  } from './tools/DEX.js';
import { lzAdapterParamsToBytes, feeBridgeBTC, dataBridgeBTC } from './tools/bridgeBTC.js';
import { feeBridgeStargate, dataBridgeETH } from './tools/bridgeETH.js';
import { subtract, multiply, divide, add } from 'mathjs';
import fs from 'fs';
import readline from 'readline-sync';
import consoleStamp from 'console-stamp';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { mintHoloNFT } from './tools/NFT.js';
import { dataBridgeCore, feeBridgeCore } from './tools/coredao.js';
import { dataBridgeHarmony, feeBridgeHarmony, lzAdapterParamsHarmony } from './tools/harmony.js';
import { claimTokenBridgeAptos, dataBridgeTokenFromAptos, dataBridgeTokenToAptos, feeBridgeAptos } from './tools/aptos.js';
import { checkStakeAmount, stakeSTG, swapETHToToken, swapETHToTokenAmount, swapETHToTokenOptimism, swapFTMToMIM, swapMIMToFTM } from './functions/stg.js';
import { dataBridgeCadabara, feeBridgeCadabra } from './tools/cadabra.js';
dotenv.config();

const output = fs.createWriteStream(`history.log`, { flags: 'a' });
const logger = new console.Console(output);
consoleStamp(console, { format: ':date(HH:MM:ss)' });
consoleStamp(logger, { format: ':date(yyyy/mm/dd HH:MM:ss)', stdout: output });

const pauseTime = generateRandomAmount(process.env.TIMEOUT_ACTION_SEC_MIN * 1000, process.env.TIMEOUT_ACTION_SEC_MAX * 1000, 0);
const pauseWalletTime = generateRandomAmount(process.env.TIMEOUT_WALLET_SEC_MIN * 1000, process.env.TIMEOUT_WALLET_SEC_MAX * 1000, 0);
const slippage = generateRandomAmount(1 - process.env.SLIPPAGE_MIN / 100, 1 - process.env.SLIPPAGE_MAX / 100, 3);
const amountGasFromArb = process.env.AMOUNT_GAS_FROM_ARBITRUM;
const amountGasToArb = process.env.AMOUNT_GAS_TO_ARBITRUM;

const getAllFeeOptimism = async() => {
    const addressExample = process.env.ADDRESS_EXAMPLE
    const numberCircles = process.env.NUMBER_CIRCLES_MAX;
    
    const amountFeeBTCBridge = await feeBridgeBTC(info.rpcOptimism, 110, '1', info.BTCb, 2, amountGasToArb, 0, addressExample);
    const amountFeeETHBridge = await feeBridgeStargate(info.rpcOptimism, 110, info.StargateRouterOptimism, 0, 0, addressExample);
    const random = generateRandomAmount(1.5, 1.7, 3);
    const amountFeeAll = parseInt(multiply(add(amountFeeBTCBridge, amountFeeETHBridge), numberCircles, random));
    
    return amountFeeAll;
}

const sendFeeToOptimism = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const amountETH = generateRandomAmount(process.env.AMOUNT_ETH_OP_MIN * 10**18, process.env.AMOUNT_ETH_OP_MAX * 10**18, 0);

    try{
        await feeBridgeStargate(info.rpcArbitrum, 111, info.StargateRouterArbitrum, 0, 0, address).then(async(bridgeFee) => {
            const value = add(amountETH, bridgeFee);
            await dataBridgeETH(info.rpcArbitrum, 111, amountETH, value, info.ETHRouterArbitrum, address).then(async(res) => {
                await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                    gasPrice = (parseFloat(gasPrice * 1.5).toFixed(5)).toString();
                    await sendEVMTX(info.rpcArbitrum, 2, res.estimateGas, info.ETHRouterArbitrum, value, res.encodeABI, privateKey, gasPrice, gasPrice);
                });
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        return;
    }
}

//===========================================================

const circleBTCBridge = async(privateKey) => {
    try {
        await swapETHToBTCbArbitrum(privateKey);
        await timeout(pauseTime);
        await bridgeBTCToChain(info.rpcArbitrum, info.chainIdOptimism, 2, amountGasFromArb, 0, privateKey);

        await waitforToken(info.rpcOptimism, info.BTCb, privateKey);
        await timeout(pauseTime);
        await bridgeBTCToChain(info.rpcOptimism, info.chainIdArbitrum, 2, amountGasToArb, 0, privateKey);

        await waitforToken(info.rpcArbitrum, info.BTCb, privateKey);
        await timeout(pauseTime);

        await swapBTCbToETHArbitrum(privateKey);
        return true;
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

const circeETHBridge = async(privateKey) => {
    try {
        console.log(chalk.magentaBright(`Bridge ETH to Optimism`));
        logger.log(`Bridge ETH to Optimism`);
        await bridgeETHToOptimism(privateKey);
        await timeout(pauseTime);
        await waitforETH(info.rpcOptimism, process.env.AMOUNT_TO_START * 10**18, privateKey);

        console.log(chalk.magentaBright(`Bridge ETH to Arbitrum`));
        logger.log(`Bridge ETH to Arbitrum`);
        await bridgeETHToArbitrum(privateKey);
        await timeout(pauseTime);

        await waitforETH(info.rpcArbitrum, process.env.AMOUNT_TO_START * 10**18, privateKey);
        console.log(chalk.magentaBright(`Receiving ETH on Arbitrum`));
        logger.log(`Receiving ETH on Arbitrum`);
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }

    return true;
}

//===========================================================

const swapETHToBTCbArbitrum = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const amountETH = parseInt(
        multiply(await getETHAmount(info.rpcArbitrum, address),
            generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MIN / 100, 3))
    );

    console.log(chalk.yellow(`Swap ${amountETH / 10**18}ETH -> BTCb`));
    logger.log(`Swap ${amountETH / 10**18}ETH -> BTCb`);
    await dataTraderJoeSwapETHToToken(info.rpcArbitrum, info.wETH, false, info.BTCb, amountETH, address, slippage).then(async(res) => {
        await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
            await sendEVMTX(info.rpcArbitrum, 2, res.estimateGas, info.routerTraderJoe, amountETH, res.encodeABI, privateKey, gasPrice, gasPrice);
        });
    });
}

const bridgeBTCToChain = async(rpcFrom, chainIdTo, lzVersion, lzGasLimit, lzNative, privateKey) => {
    const address = privateToAddress(privateKey);
    const balanceBTCB = rpcFrom == info.rpcAvalanche ? await getAmountToken(rpcFrom, info.BTCbAvalanche, address) : await getAmountToken(rpcFrom, info.BTCb, address);
    const chainFrom = (Object.keys(info)[Object.values(info).findIndex(e => e == chainIdTo)]).slice(3);
    const chainTo = (Object.keys(info)[Object.values(info).findIndex(e => e == rpcFrom)]).slice(5);

    await feeBridgeBTC(rpcFrom, chainIdTo, balanceBTCB, info.BTCb, lzVersion, lzGasLimit, lzNative, address).then(async(bridgeFee) => {
        await lzAdapterParamsToBytes(lzVersion, lzGasLimit, lzNative, address).then(async(adapterParams) => {
            await dataBridgeBTC(rpcFrom, balanceBTCB, chainIdTo, adapterParams, bridgeFee, info.BTCb, address).then(async(res) => {
                await getGasPrice(rpcFrom).then(async(gasPrice) => {
                    gasPrice = (parseFloat(gasPrice * 1.2).toFixed(9)).toString();
                    let priorityFee = rpcFrom == info.rpcPolygon ? '30'
                        : rpcFrom == info.rpcAvalanche ? '1.5'
                        : gasPrice;
                    const typeTX = rpcFrom == info.rpcArbitrum || rpcFrom == info.rpcPolygon || rpcFrom == info.rpcAvalanche ? 2 : 0;
                    await sendEVMTX(rpcFrom, typeTX, parseInt(res.estimateGas * 1.5), info.BTCb, bridgeFee, res.encodeABI, privateKey, gasPrice, priorityFee);
                    console.log(chalk.magentaBright(`Successful Bridge from ${chainFrom} to ${chainTo}`));
                    logger.log(`Successful Bridge from ${chainFrom} to ${chainTo}`);
                });
            });
        });
    });
    
    return true;
}

const approveBridgeAvalanche = async(privateKey) => {
    const address = privateToAddress(privateKey);

    await getAmountToken(info.rpcAvalanche, info.BTCbAvalanche, address).then(async(amountBTCb) => {
        await checkAllowance(info.rpcAvalanche, info.BTCbAvalanche, address, info.BTCb).then(async(res) => {
            if (Number(res) < amountBTCb) {
                console.log(chalk.yellow(`Start Approve BTCb for Router`));
                logger.log(`Start Approve BTCb for Router`);
                await dataApprove(info.rpcAvalanche, info.BTCbAvalanche, info.BTCb, address).then(async(res1) => {
                    await getGasPrice(info.rpcAvalanche).then(async(gasPrice) => {
                        gasPrice = (parseFloat(gasPrice * 1.2).toFixed(5)).toString();
                        await sendEVMTX(info.rpcAvalanche, 2, res1.estimateGas, info.BTCbAvalanche, null, res1.encodeABI, privateKey, gasPrice, '1.5');
                    });
                });
            } else if (Number(res) >= amountBTCb) {
                console.log(chalk.magentaBright(`Approve BTCb Successful`));
                logger.log(`Approve BTCb Successful`);
                await timeout(pauseTime);
            }
        });
    });
}

const mainRandomBridge = async(privateKey) => {
    console.log(chalk.cyan('Start Random Bridge BTC'));
    logger.log('Start Random Bridge BTC');

    try {
        await swapETHToBTCbArbitrum(privateKey);
        await timeout(pauseTime);

        const numberChain = generateRandomAmount(process.env.NUMBER_CHAIN_MIN, process.env.NUMBER_CHAIN_MAX, 0);
        const allChains = ['Optimism', 'BSC', 'Avalanche'];
        let chainNow = 'Arbitrum';
        let chainTo = allChains[generateRandomAmount(0, allChains.length - 1, 0)];

        for (let n = 1; n <= numberChain; n++) {
            if (n == 1) {
                console.log('STAGE 1');
                console.log(chalk.yellow(`Bridge BTCb ${chainNow} -> ${chainTo}`));
                logger.log(`Bridge BTCb ${chainNow} -> ${chainTo}`);

                await bridgeBTCToChain(info.rpcArbitrum, info['chainId' + chainTo], 2, amountGasFromArb, 0, privateKey);
            } else if (n < numberChain) {
                console.log(`STAGE 2 CIRCLE ${n - 1}`);
                const token = chainNow == 'Avalanche' ? info.BTCbAvalanche : info.BTCb;

                await waitforToken(info['rpc' + chainNow], token, privateKey);
                await timeout(pauseTime);

                shuffle(allChains);
                chainTo = chainNow == allChains[0] ? allChains[1] : allChains[0];

                console.log(chalk.yellow(`Bridge ${balanceBTCb / 10**8}BTCb ${chainNow} -> ${chainTo}`));
                logger.log(`Bridge ${balanceBTCb / 10**8}BTCb ${chainNow} -> ${chainTo}`);
                if (chainNow == 'Avalanche') { await approveBridgeAvalanche(privateKey); }
                await bridgeBTCToChain(info['rpc' + chainNow], info['chainId' + chainTo], 2, amountGasFromArb, 0, privateKey);
            } else {
                console.log('STAGE 3');
                const token = chainNow == 'Avalanche' ? info.BTCbAvalanche : info.BTCb;

                await waitforToken(info['rpc' + chainNow], token, privateKey);
                await timeout(pauseTime);

                chainTo = 'Arbitrum';
                console.log(chalk.yellow(`Bridge ${balanceBTCb / 10**8}BTCb ${chainNow} -> ${chainTo}`));
                logger.log(`Bridge ${balanceBTCb / 10**8}BTCb ${chainNow} -> ${chainTo}`);
                if (chainNow == 'Avalanche') { await approveBridgeAvalanche(privateKey); }
                await bridgeBTCToChain(info['rpc' + chainNow], info['chainId' + chainTo], 2, amountGasToArb, 0, privateKey);
            }
        }

        await waitforToken(info.rpcArbitrum, info.BTCb, privateKey);
        await timeout(pauseTime);

        await swapBTCbToETHArbitrum(privateKey);
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }

    return true;
}

const swapBTCbToETHArbitrum = async(privateKey) => {
    const address = privateToAddress(privateKey);

    console.log(chalk.yellow(`Approve BTCb TraderJoe`));
    logger.log(`Approve BTCb TraderJoe`);
    try {
        await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(amountBTCb) => {
            await checkAllowance(info.rpcArbitrum, info.BTCb, address, info.routerTraderJoe).then(async(res) => {
                if (Number(res) < amountBTCb) {
                    console.log(chalk.yellow(`Start Approve BTCb for Router`));
                    logger.log(`Start Approve BTCb for Router`);
                    await dataApprove(info.rpcArbitrum, info.BTCb, info.routerTraderJoe, address).then(async(res1) => {
                        await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                            await sendEVMTX(info.rpcArbitrum, 2, res1.estimateGas, info.BTCb, null, res1.encodeABI, privateKey, gasPrice, gasPrice);
                        });
                    });
                    await timeout(pauseTime);
                } else if (Number(res) >= amountBTCb) {
                    console.log(chalk.magentaBright(`Approve BTCb Successful`));
                    logger.log(`Approve BTCb Successful`);
                    await timeout(pauseTime);
                }
            });
        });
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }

    try {
        console.log(chalk.yellow(`Swap BTCb -> ETH`));
        logger.log(`Swap BTCb -> ETH`);
        await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(amountBTCb) => {
            await dataTraderJoeSwapTokenToETH(info.rpcArbitrum, info.BTCb, false, info.wETH, amountBTCb, address, slippage).then(async(res) => {
                await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                    await sendEVMTX(info.rpcArbitrum, 2, res.estimateGas, info.routerTraderJoe, null, res.encodeABI, privateKey, gasPrice, gasPrice);
                    console.log(chalk.magentaBright(`Swap BTCb -> ETH Successful`));
                    logger.log(`Swap BTCb -> ETH Successful`);
                });
            });
        });
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

//============================================================

const bridgeETHToOptimism = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const amountETH = parseInt(
        multiply(await getETHAmount(info.rpcArbitrum, address),
            generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MIN / 100, 3))
    );

    await feeBridgeStargate(info.rpcArbitrum, 111, info.StargateRouterArbitrum, 0, 0, address).then(async(bridgeFee) => {
        const value = add(amountETH, bridgeFee);
        await dataBridgeETH(info.rpcArbitrum, 111, amountETH, value, info.ETHRouterArbitrum, address).then(async(res) => {
            await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                gasPrice = (parseFloat(gasPrice * 1.2).toFixed(5)).toString();
                await sendEVMTX(info.rpcArbitrum, 2, res.estimateGas, info.ETHRouterArbitrum, value, res.encodeABI, privateKey, gasPrice, gasPrice);
            });
        });
    });
}

const bridgeETHToArbitrum = async(privateKey) => {
    const address = privateToAddress(privateKey);
    
    await getETHAmount(info.rpcOptimism, address).then(async(balanceETH) => {
        const amountETH = subtract(balanceETH, generateRandomAmount(process.env.AMOUNT_ETH_OP_MIN * 10**18, process.env.AMOUNT_ETH_OP_MAX * 10**18, 0));
        await feeBridgeStargate(info.rpcOptimism, 110, info.StargateRouterOptimism, 0, 0, address).then(async(bridgeFee) => {
            const value = (add(amountETH, bridgeFee)).toString();
            await dataBridgeETH(info.rpcOptimism, 110, amountETH, value, info.ETHRouterOptimism, address).then(async(res) => {
                await getGasPrice(info.rpcOptimism).then(async(gasPrice) => {
                    gasPrice = (parseFloat(gasPrice * 1.2).toFixed(9)).toString();
                    await sendEVMTX(info.rpcOptimism, 0, res.estimateGas, info.ETHRouterOptimism, value, res.encodeABI, privateKey, gasPrice);
                });
            });
        });
    });

    return true;
}

const bridgeAllETHToArbitrum = async(privateKey) => {
    const address = privateToAddress(privateKey);

    try{
        await getETHAmount(info.rpcOptimism, address).then(async(balanceETH) => {
            await getGasPrice(info.rpcETH).then(async(gasPriceETH) => {
                await feeBridgeStargate(info.rpcOptimism, 110, info.StargateRouterOptimism, 0, 0, address).then(async(bridgeFee) => {
                    let value = add(parseInt(balanceETH * 0.1), bridgeFee);
                    await dataBridgeETH(info.rpcOptimism, 110, parseInt(balanceETH * 0.1), value, info.ETHRouterOptimism, address).then(async(res) => {
                        await getGasPrice(info.rpcOptimism).then(async(gasPriceOP) => {
                            gasPriceETH = (parseFloat(gasPriceETH * 1.1).toFixed(5)).toString();
                            gasPriceOP = (parseFloat(gasPriceOP * 1.1).toFixed(9)).toString();
                            const amountFee = parseInt(add(multiply(gasPriceOP*10**9, res.estimateGas), gasPriceETH*10**9 * 6000 * 0.684));
                            await feeBridgeStargate(info.rpcOptimism, 110, info.StargateRouterOptimism, 0, 0, address).then(async(bridgeFee) => {
                                const amountETH = subtract(balanceETH, add(amountFee, bridgeFee));
                                value = add(amountETH, bridgeFee);
                                await dataBridgeETH(info.rpcOptimism, 110, amountETH, value, info.ETHRouterOptimism, address).then(async(res1) => {
                                    await sendEVMTX(info.rpcOptimism, 0, res1.estimateGas, info.ETHRouterOptimism, value, res1.encodeABI, privateKey, gasPriceOP);
                                });
                            }); 
                        });
                    });
                });
            });
        });
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

//============================================================

const priorityGas = 1;

const waitforToken = async(rpc, token, privateKey) => {
    const address = privateToAddress(privateKey);

    try {
        let status;
        while(!status) {
            await getAmountToken(rpc, token, address).then(async(balance) => {
                if (balance == 0) {
                    console.log('Wait for Token. Update every 1 min');
                    logger.log('Wait for Token. Update every 1 min');
                    await timeout(60000);
                } else if (balance > 0) {
                    console.log(chalk.magentaBright('Find token!'));
                    logger.log('Find token!');
                    status = true;
                }
            });
        }
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

const waitforETH = async(rpc, amountETH, privateKey) => {
    const address = privateToAddress(privateKey);

    try {
        let status;
        while(!status) {
            await getETHAmount(rpc, address).then(async(balanceETH) => {
                if (balanceETH < amountETH) {
                    console.log('Wait for ETH. Update every 2 min');
                    logger.log('Wait for ETH. Update every 2 min');
                    await timeout(120000);
                } else if (balanceETH >= amountETH) {
                    console.log(`Find ${parseFloat(balanceETH/10**18).toFixed(4)}ETH!`);
                    logger.log(`Find ${parseFloat(balanceETH/10**18).toFixed(4)}ETH!`);
                    status = true;
                }
            });
        }
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

const findToken = async(rpc, arrToken, privateKey) => {
    const address = privateToAddress(privateKey);

    try {
        for (let i = 0; i < arrToken.length; i++) {
            const balance = await getAmountToken(rpc, arrToken[i], address);
            if (balance > 0) {
                return arrToken[i];
            }
        }
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

const swapETHToTokenRandomBSC = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const random = generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MAX / 100, 3);

    const chains = ['BSC'];
    const tokens = ['USDT', 'USDC'];
    const chain = chains[generateRandomAmount(0, chains.length - 1, 0)];
    const ticker = tokens[generateRandomAmount(0, tokens.length - 1, 0)];
    const native = info.wBNB;
    const rpc = info['rpc' + chain];
    const token = info['bsc' + ticker];
    const tokenMid = ticker == 'USDC' ? info.bscUSDT : false;

    try {
        await getETHAmount(rpc, address).then(async(balanceETH) => {
            const amountETH = parseInt(multiply(balanceETH, random)/10**13)*10**13;
            console.log(`Swap ${parseFloat(amountETH/10**18).toFixed(4)}BNB for ${ticker} in ${chain}`);
            logger.log(`Swap ${parseFloat(amountETH/10**18).toFixed(4)}BNB for ${ticker} in ${chain}`);
            await dataTraderJoeSwapETHToToken(rpc, native, tokenMid, token, amountETH, address, slippage).then(async(res) => {
                await getGasPrice(rpc).then(async(gasPrice) => {
                    gasPrice = parseFloat(multiply(gasPrice, priorityGas)).toFixed(4);
                    const typeTX = chain == 'Arbitrum' ? 2 : 0;
                    await sendEVMTX(rpc, typeTX, parseInt(res.estimateGas * 1.5), info.routerTraderJoe, amountETH, res.encodeABI, privateKey, gasPrice, gasPrice);
                });
            });
        });
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

const swapETHToTokenRandomARB = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const random = generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MAX / 100, 3);

    const chains = ['Arbitrum'];
    const tokens = ['USDT', 'USDC'];
    const chain = chains[0];
    const ticker = tokens[generateRandomAmount(0, 1, 0)];
    const native = info.wETH;
    const rpc = info['rpc' + chain];
    const token = info['arb' + ticker];

    try {
        await getETHAmount(rpc, address).then(async(balanceETH) => {
            const amountETH = parseInt(multiply(balanceETH, random));
            console.log(`Swap ${parseFloat(amountETH/10**18).toFixed(4)}ETH for ${ticker} in ${chain}`);
            logger.log(`Swap ${parseFloat(amountETH/10**18).toFixed(4)}ETH for ${ticker} in ${chain}`);
            await dataTraderJoeSwapETHToToken(rpc, native, false, token, amountETH, address, slippage).then(async(res) => {
                await getGasPrice(rpc).then(async(gasPrice) => {
                    gasPrice = parseFloat(multiply(gasPrice, priorityGas)).toFixed(4);
                    const typeTX = chain == 'Arbitrum' ? 2 : 0;
                    await sendEVMTX(rpc, typeTX, parseInt(res.estimateGas * 1.5), info.routerTraderJoe, amountETH, res.encodeABI, privateKey, gasPrice, gasPrice);
                });
            });
        });
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

const bridgeTokenToCore = async(arrToken, privateKey) => {
    const address = privateToAddress(privateKey);

    try{
        const rpc = info.rpcBSC;
        const tokens = arrToken;
        for (let i = 0; i < tokens.length; i++) {
            await getAmountToken(rpc, tokens[i], address).then(async(balanceToken) => {
                const token = tokens[i] == info.bscUSDC ? 'USDC' : 'USDT';
                if (balanceToken > 0) {
                    await getGasPrice(rpc).then(async(gasPrice) => {
                        gasPrice = (parseFloat(gasPrice * priorityGas).toFixed(4)).toString();
                        await checkAllowance(rpc, tokens[i], address, info.bridgeCoreBSC).then(async(allowance) => {
                            if (Number(allowance) < balanceToken) {
                                await dataApprove(rpc, tokens[i], info.bridgeCoreBSC, address).then(async(res) => {
                                    await sendEVMTX(rpc, 0, res.estimateGas, tokens[i], null, res.encodeABI, privateKey, gasPrice);
                                    logger.log(`Approve ${token} for CoreDAO Bridge`);
                                    console.log(chalk.magentaBright(`Approve ${token} for CoreDAO Bridge`));
                                })
                            }
                        });

                        await timeout(pauseTime);
                        await feeBridgeCore(rpc, false, 0, '0x', info.bridgeCoreBSC).then(async(bridgeFee) => {
                            await dataBridgeCore(rpc, false, 0, tokens[i], balanceToken, '0x', bridgeFee, info.bridgeCoreBSC, address).then(async(res) => {   
                                await sendEVMTX(rpc, 0, res.estimateGas, info.bridgeCoreBSC, bridgeFee, res.encodeABI, privateKey, gasPrice);
                                logger.log(`Bridge All ${token} to CoreDAO`);
                                console.log(chalk.magentaBright(`Bridge All ${token} to CoreDAO`));
                            });
                        });
                    });
                } else if (balanceToken == 0) {
                    logger.log(`Balance ${token} = 0. Check next token.`);
                    console.log(chalk.yellow(`Balance ${token} = 0. Check next token.`));
                }
            });
        }
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

const bridgeTokenFromCore = async(privateKey) => {
    const address = privateToAddress(privateKey);

    try{
        const tokens = [info.coreUSDC, info.coreUSDT];
        const rpc = info.rpcCore;
        for (let i = 0; i < tokens.length; i++) {
            await getAmountToken(rpc, tokens[i], address).then(async(balanceToken) => {
                const token = tokens[i] == info.coreUSDC ? 'USDC' : 'USDT';
                if (balanceToken > 0) {
                    await getGasPrice(rpc).then(async(gasPrice) => {
                        gasPrice = (parseFloat(gasPrice * 1.2).toFixed(4)).toString();
                        await checkAllowance(rpc, tokens[i], address, info.bridgeCoreCORE).then(async(allowance) => {
                            if (Number(allowance) < balanceToken) {
                                await dataApprove(rpc, tokens[i], info.bridgeCoreCORE, address).then(async(res) => {
                                    await sendEVMTX(rpc, 0, res.estimateGas, tokens[i], null, res.encodeABI, privateKey, gasPrice);
                                    logger.log(`Approve ${token} for CoreDAO Bridge`);
                                    console.log(chalk.magentaBright(`Approve ${token} for CoreDAO Bridge`));
                                })
                            }
                        });

                        await timeout(pauseTime);
                        await feeBridgeCore(rpc, true, info.chainIdBSC, '0x', info.bridgeCoreCORE).then(async(bridgeFee) => {
                            await dataBridgeCore(rpc, true, info.chainIdBSC, tokens[i], balanceToken, '0x', bridgeFee, info.bridgeCoreCORE, address).then(async(res) => {
                                await sendEVMTX(rpc, 0, res.estimateGas, info.bridgeCoreCORE, bridgeFee, res.encodeABI, privateKey, gasPrice);
                                logger.log(`Bridge All ${token} CoreDAO -> BSC`);
                                console.log(chalk.magentaBright(`Bridge All ${token} CoreDAO -> BSC`));
                            });
                        });
                    });
                } else if (balanceToken == 0) {
                    logger.log(`Balance ${token} = 0. Check next token.`);
                    console.log(chalk.yellow(`Balance ${token} = 0. Check next token.`));
                }
            });
        }
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

const bridgeTokenToHarmony = async(arrRpc, arrToken, privateKey) => {
    const address = privateToAddress(privateKey);

    try{
        let rpc = arrRpc;
        const tokens = arrToken;
        for (let i = 0; i < rpc.length; i++) {
            const chain = rpc[i] == info.rpcBSC ? 'BSC' : 'Arbitrum';
            for (let n = 0; n < tokens.length; n++) {
                await getAmountToken(rpc[i], tokens[n], address).then(async(balanceToken) => {
                    const token = tokens[n] == info.bscUSDC || tokens[n] == info.arbUSDC ? 'USDC' : 'USDT';
                    const router = tokens[n] == info.bscUSDC ? info.bridgeHarmonyUSDCBSC
                        : tokens[n] == info.bscUSDT ? info.bridgeHarmonyUSDTBSC
                        : tokens[n] == info.arbUSDC ? info.bridgeHarmonyUSDCARB
                        : info.bridgeHarmonyUSDTARB;
                    const typeTX = rpc[i] == info.rpcArbitrum ? 2 : 0;
                    if (balanceToken > 0) {
                        await getGasPrice(rpc[i]).then(async(gasPrice) => {
                            gasPrice = (parseFloat(gasPrice * priorityGas).toFixed(4)).toString();
                            await checkAllowance(rpc[i], tokens[n], address, router).then(async(allowance) => {
                                if (Number(allowance) < balanceToken) {
                                    await dataApprove(rpc[i], tokens[n], router, address).then(async(res) => {
                                        logger.log(`Approve ${token} for Harmony Bridge`);
                                        console.log(chalk.magentaBright(`Approve ${token} for Harmony Bridge`));
                                        await sendEVMTX(rpc[i], typeTX, res.estimateGas, tokens[n], null, res.encodeABI, privateKey, gasPrice, gasPrice);
                                    });
                                }
                            });

                            await timeout(pauseTime);
                            await feeBridgeHarmony(rpc[i], info.chainIdHarmony, balanceToken, router, 1, 500000, address).then(async(bridgeFee) => {
                                await lzAdapterParamsHarmony(1, 500000).then(async(adapterParams) => {
                                    adapterParams = chain == 'BSC' ? adapterParams : '0x';
                                    await dataBridgeHarmony(rpc[i], balanceToken, info.chainIdHarmony, adapterParams, bridgeFee, router, address).then(async(res) => {
                                        logger.log(`Bridge All ${token} ${chain} -> Harmony`);
                                        console.log(chalk.magentaBright(`Bridge All ${token} ${chain} -> Harmony`));
                                        await sendEVMTX(rpc[i], typeTX, res.estimateGas, router, bridgeFee, res.encodeABI, privateKey, gasPrice, gasPrice);
                                    });
                                });
                            });
                        });
                    } else if (balanceToken == 0) {
                        logger.log(`Balance ${token} = 0. Check next token.`);
                        console.log(chalk.yellow(`Balance ${token} = 0. Check next token.`));
                    }
                });
            }
        }
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

const bridgeTokenFromHarmony = async(privateKey) => {
    const address = privateToAddress(privateKey);

    try{
        const rpc = info.rpcHarmony;
        const tokens = [info.oneBSCUSDC, info.oneBSCUSDT, info.oneARBUSDC, info.oneARBUSDT];
        for (let i = 0; i < tokens.length; i++) {
            await getAmountToken(rpc, tokens[i], address).then(async(balanceToken) => {
                const token = tokens[i] == info.oneBSCUSDC || tokens[i] == info.oneARBUSDC ? 'USDC' : 'USDT';
                const router = tokens[i] == info.oneBSCUSDC ? info.bridgeHarmonyBSCUSDCONE
                    : tokens[i] == info.oneBSCUSDT ? info.bridgeHarmonyBSCUSDTONE
                    : tokens[i] == info.oneARBUSDC ? info.bridgeHarmonyARBUSDCONE
                    : info.bridgeHarmonyARBUSDTONE;
                const dstChain = tokens[i] == info.oneBSCUSDC || tokens[i] == info.oneBSCUSDT ? info.chainIdBSC : info.chainIdArbitrum;
                if (balanceToken > 0) {
                    await getGasPrice(rpc).then(async(gasPrice) => {
                        gasPrice = (parseFloat(gasPrice * 1.2).toFixed(4)).toString();
                        await checkAllowance(rpc, tokens[i], address, router).then(async(allowance) => {
                            if (Number(allowance) < balanceToken) {
                                await dataApprove(rpc, tokens[i], router, address).then(async(res) => {
                                    await sendEVMTX(rpc, 0, res.estimateGas, tokens[i], null, res.encodeABI, privateKey, gasPrice);
                                    logger.log(`Approve ${token} for Harmony Bridge`);
                                    console.log(chalk.magentaBright(`Approve ${token} for Harmony Bridge`));
                                })
                            }
                        });

                        await timeout(pauseTime);
                        await feeBridgeHarmony(rpc, dstChain, balanceToken, router, 1, 300000, address).then(async(bridgeFee) => {
                            await dataBridgeHarmony(rpc, balanceToken, dstChain, '0x', bridgeFee, router, address).then(async(res) => {
                                await sendEVMTX(rpc, 0, res.estimateGas, router, bridgeFee, res.encodeABI, privateKey, gasPrice);
                                logger.log(`Bridge All ${token} from Harmony to Chain`);
                                console.log(chalk.magentaBright(`Bridge All ${token} from Harmony to Chain`));
                            });
                        });
                    });
                } else if (balanceToken == 0) {
                    logger.log(`Check next token`);
                    console.log(chalk.yellow(`Check next token`));
                }
            });
        }
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

const bridgeTokenToAptos = async(rpc, privateKey) => {
    const address = privateToAddress(privateKey);
    const addressAPT = privateToAptosAddress(privateKey);

    try{
        const tokens = [info.bscUSDC, info.bscUSDT, info.arbUSDC];
        let n = rpc == info.rpcBSC ? 0 : 2;
        const length = rpc == info.rpcBSC ? 2 : 3;
        const chain = rpc == info.rpcBSC ? 'BSC' : 'Arbitrum';
        const router = rpc == info.rpcBSC ? info.bridgeAptosBSC : info.bridgeAptosARB;
        let nativeDstAmount;
        for (n; n < length; n++) {
            await getAmountToken(rpc, tokens[n], address).then(async(balanceToken) => {
                const token = tokens[n] == info.bscUSDC || tokens[n] == info.arbUSDC ? 'USDC' : 'USDT';
                if (balanceToken > 0) {
                    try {
                        nativeDstAmount = rpc == info.rpcBSC && await getAPTBalance(info.rpcAptos, addressAPT) < 0.09 * 10**8
                            ? generateRandomAmount(0.09 * 10**8, 0.1 * 10**8, 0)
                            : rpc == info.rpcArbitrum && await getAPTBalance(info.rpcAptos, addressAPT) < 0.51 * 10**8 ? generateRandomAmount(0.51 * 10**8, 0.54 * 10**8, 0)
                            : 0;
                        console.log(nativeDstAmount);
                    } catch (err) {
                        nativeDstAmount = rpc == info.rpcBSC
                            ? generateRandomAmount(0.09 * 10**8, 0.1 * 10**8, 0)
                            : generateRandomAmount(0.52 * 10**8, 0.54 * 10**8, 0);
                        console.log(nativeDstAmount);
                    }
                    await getGasPrice(rpc).then(async(gasPrice) => {
                        gasPrice = (parseFloat(gasPrice * 1.2).toFixed(4)).toString();
                        await checkAllowance(rpc, tokens[n], address, router).then(async(allowance) => {
                            if (Number(allowance) < balanceToken) {
                                await dataApprove(rpc, tokens[n], router, address).then(async(res) => {
                                    await sendEVMTX(rpc, 0, res.estimateGas, tokens[n], null, res.encodeABI, privateKey, gasPrice);
                                    logger.log(`Approve ${token} in ${chain} for Aptos Bridge`);
                                    console.log(chalk.magentaBright(`Approve ${token} in ${chain} for Aptos Bridge`));
                                });
                            }
                        });

                        await timeout(pauseTime);
                        await feeBridgeAptos(rpc, router, 2, 10000, nativeDstAmount, address).then(async(bridgeFee) => {
                            await lzAdapterParamsToBytes(2, 10000, nativeDstAmount, addressAPT).then(async(adapterParams) => {
                                await dataBridgeTokenToAptos(rpc, router, tokens[n], balanceToken, addressAPT, adapterParams, bridgeFee, address).then(async(res) => {   
                                    await sendEVMTX(rpc, 0, res.estimateGas, router, bridgeFee, res.encodeABI, privateKey, gasPrice);
                                    logger.log(`Bridge All ${token} in ${chain} to Aptos`);
                                    console.log(chalk.magentaBright(`Bridge All ${token} in ${chain} to Aptos`));
                                });
                            });
                        });
                    });
                } else if (balanceToken == 0) {
                    logger.log(`Balance ${token} in ${chain} = 0. Check next token.`);
                    console.log(chalk.yellow(`Balance ${token} in ${chain} = 0. Check next token.`));
                }
            });
        }
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

const claimAllTokenAptos = async(ticker, privateKey) => {
    const addressAPT = privateToAptosAddress(privateKey);
    

    try{
        logger.log(`Aptos Wallet: ${addressAPT}`);
        console.log(chalk.magentaBright(`Aptos Wallet: ${addressAPT}`));
        await claimTokenBridgeAptos(info.rpcAptos, ticker, privateKey);
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

const bridgeTokenFromAptos = async(dstChainId, privateKey) => {
    const address = privateToAddress(privateKey);
    const addressAPT = privateToAptosAddress(privateKey);

    try{
        const tokens = dstChainId == info.chainIdBSC ? ['USDC', 'USDT'] : ['USDC'];
        logger.log(`Aptos Wallet: ${addressAPT}`);
        console.log(chalk.blue(`Aptos Wallet: ${addressAPT}`));
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            let balanceToken;
            try {
                balanceToken = await getTokenBalanceAptos(info.rpcAptos, addressAPT, token);
            } catch { balanceToken = 0; }
            if (balanceToken > 0) {
                logger.log(`Find ${token}`);
                console.log(chalk.yellow(`Find ${token}`));
                const feeBridge = dstChainId == info.chainIdBSC ? '8000000' : '50000000';
                const toChain = dstChainId == info.chainIdBSC ? 'BSC' : 'Arbitrum';
                await dataBridgeTokenFromAptos(info.rpcAptos, token, dstChainId, balanceToken, feeBridge, address, privateKey);
                logger.log(`Bridge ${token} to ${toChain}`);
                console.log(chalk.magentaBright(`Bridge ${token} to ${toChain}`));
            } else if (balanceToken == 0) {
                logger.log(`Balance ${token} = 0. Check next`);
                console.log(chalk.yellow(`Balance ${token} = 0. Check next`));
            }
        }
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

const swapAllTokenInETH = async(privateKey) => {
    const address = privateToAddress(privateKey);

    const chains = ['Arbitrum', 'BSC'];
    const tokens = ['USDT', 'USDC'];

    try {
        for (let i = 0; i < chains.length; i++) {
            for (let n = 0; n < chains.length; n++) {
                let chain = chains[i];
                let ticker = tokens[n];
                const native = chain == 'Arbitrum' ? info.wETH : info.wBNB;
                const rpc = info['rpc' + chain];
                const preTick = chain == 'Arbitrum' ? 'arb' : 'bsc';
                const token = info[preTick + ticker];
                const typeTX = chain == 'Arbitrum' ? 2 : 0;
                const tokenMid = ticker == 'USDC' ? info.bscUSDT : false;

                await getAmountToken(rpc, token, address).then(async(balanceToken) => {
                    if (balanceToken > 0) {
                        console.log(chalk.cyanBright(`Find ${ticker} in ${chain}`));
                        logger.log(`Find ${ticker} in ${chain}`);
                        await getGasPrice(rpc).then(async(gasPrice) => {
                            gasPrice = (parseFloat(gasPrice * 1.2).toFixed(4)).toString();
                            await checkAllowance(rpc, token, address, info.routerTraderJoe).then(async(allowance) => {
                                if (Number(allowance) < balanceToken) {
                                    await dataApprove(rpc, token, info.routerTraderJoe, address).then(async(res) => {
                                        await sendEVMTX(rpc, typeTX, parseInt(res.estimateGas * 1.5), token, null, res.encodeABI, privateKey, gasPrice, gasPrice);
                                        logger.log(`Approve ${ticker} in ${chain} for TraderJoe`);
                                        console.log(chalk.magentaBright(`Approve ${ticker} in ${chain} for TraderJoe`));
                                    })
                                }
                            });

                            await timeout(pauseTime);
                            await dataTraderJoeSwapTokenToETH(rpc, token, tokenMid, native, balanceToken, address, slippage).then(async(res) => {
                                await sendEVMTX(rpc, typeTX, parseInt(res.estimateGas * 1.5), info.routerTraderJoe, null, res.encodeABI, privateKey, gasPrice, gasPrice);
                                console.log(chalk.magentaBright(`Swap ${ticker} -> ETH`));
                                logger.log(`Swap ${ticker} -> ETH`);
                            });
                        });
                        await timeout(pauseTime);
                    } else if (balanceToken == 0) {
                        console.log(`Balance ${ticker} in ${chain} == 0. Check next token`);
                        logger.log(`Balance ${ticker} in ${chain} == 0. Check next token`);
                    }
                });
            }
        }
    } catch (err) {
        logger.log(err);
        console.log(chalk.red(err.message));
        return;
    }
}

const mainFunc = async(chain, privateKey) => {
    const firstFunc = chain == 'BSC' ? swapETHToTokenRandomBSC : swapETHToTokenRandomARB;
    await firstFunc(privateKey);
    await timeout(pauseTime);
    let token = await findToken(info['rpc' + chain], [info.bscUSDC, info.bscUSDT], privateKey);

    if (chain == 'BSC') {
        await bridgeTokenToCore([token], privateKey);

        await timeout(pauseTime);
        token = token == info.bscUSDT ? info.coreUSDT : info.coreUSDC;
        await waitforToken(info.rpcCore, token, privateKey);
        await bridgeTokenFromCore(privateKey);

        await timeout(pauseTime);
        token = token == info.coreUSDT ? info.bscUSDT : info.bscUSDC;
        await waitforToken(info.rpcBSC, token, privateKey);
    }

    const chainHarm = info['rpc' + chain];

    await bridgeTokenToHarmony([chainHarm], [token], privateKey);
    await timeout(pauseTime);

    token = token == info.bscUSDC ? info.oneBSCUSDC
        : token == info.bscUSDT ? info.oneBSCUSDT
        : token == info.arbUSDC ? info.oneARBUSDC
        : info.oneARBUSDT;
    await waitforToken(info.rpcHarmony, token, privateKey);
    await timeout(pauseTime);

    token = token == info.oneBSCUSDC ? info.bscUSDC
    : token == info.oneBSCUSDT ? info.bscUSDT
    : token == info.oneARBUSDC ? info.arbUSDC
    : info.arbUSDT;
    await bridgeTokenFromHarmony(privateKey);
    await waitforToken(chainHarm, token, privateKey);
    await timeout(pauseTime);

    await swapAllTokenInETH(privateKey);
}

const firstFunc = async(privateKey) => {
    const rpc = info.rpcBSC;
    await swapETHToTokenRandomBSC(privateKey);
    await timeout(pauseTime);
    let token = await findToken(rpc, [info.bscUSDC, info.bscUSDT], privateKey);

    await bridgeTokenToCore([token], privateKey);
    await timeout(pauseTime);

    token = token == info.bscUSDT ? info.coreUSDT : info.coreUSDC;
    await waitforToken(info.rpcCore, token, privateKey);
    await bridgeTokenFromCore(privateKey);
}

const secondFunc = async(privateKey) => {
    const rpc = info.rpcBSC;
    let token = await findToken(rpc, [info.bscUSDC, info.bscUSDT], privateKey);

    await bridgeTokenToHarmony([rpc], [token], privateKey);
    await timeout(pauseTime);

    token = token == info.bscUSDC ? info.oneBSCUSDC : info.oneBSCUSDT;
    await waitforToken(info.rpcHarmony, token, privateKey);
    await timeout(pauseTime);

    token = token == info.oneBSCUSDC ? info.bscUSDC : info.bscUSDT;
    await bridgeTokenFromHarmony(privateKey);
    await waitforToken(rpc, token, privateKey);
    await timeout(pauseTime);

    await swapAllTokenInETH(privateKey);
}

const bridgeTokenFromFantom = async(privateKey) => {
    const address = privateToAddress(privateKey);

    try{
        const rpc = info.rpcFantom;
        const token = info.MIM;
        const dstChain = info.chainIdMoonriver;
        const router = info.cadabraBridgeFTM;
        await getAmountToken(rpc, token, address).then(async(balanceToken) => {
            if (balanceToken > 0) {
                balanceToken = parseInt(multiply(balanceToken, divide(0.75, process.env.NUMBER_CIRCLES_MAX)));
                await getGasPrice(rpc).then(async(gasPrice) => {
                    gasPrice = (parseFloat(gasPrice * 1.2).toFixed(9)).toString();
                    /*await checkAllowance(rpc, tokens[i], address, router).then(async(allowance) => {
                        if (Number(allowance) < balanceToken) {
                            await dataApprove(rpc, tokens[i], router, address).then(async(res) => {
                                await sendEVMTX(rpc, 0, res.estimateGas, tokens[i], null, res.encodeABI, privateKey, gasPrice);
                                logger.log(`Approve ${token} for Harmony Bridge`);
                                console.log(chalk.magentaBright(`Approve ${token} for Harmony Bridge`));
                            })
                        }
                    });
                    await timeout(pauseTime);*/

                    await feeBridgeCadabra(rpc, dstChain, balanceToken, router, 2, 100000, '0', address).then(async(bridgeFee) => {
                        await lzAdapterParamsToBytes(2, 100000, 0, address).then(async(adapterParams) => {
                            await dataBridgeCadabara(rpc, balanceToken, dstChain, adapterParams, bridgeFee, router, address).then(async(res) => {
                                await sendEVMTX(rpc, 0, res.estimateGas, router, bridgeFee, res.encodeABI, privateKey, gasPrice);
                                logger.log(`Bridge All MIM from Fantom to Moonriver`);
                                console.log(chalk.magentaBright(`Bridge All MIM from Fantom to Moonriver`));
                            });
                        });
                    });
                });
            } else if (balanceToken == 0) {
                logger.log(`Balance token = 0`);
                console.log(chalk.yellow(`Balance token = 0`));
            }
        });
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}

const bridgeTokenFromMoonriver = async(privateKey) => {
    const address = privateToAddress(privateKey);

    try{
        const rpc = info.rpcMoonriver;
        const token = info.MIMMoonriver;
        const dstChain = info.chainIdFantom;
        const router = info.cadabraBridgeMOVR;
        await getAmountToken(rpc, token, address).then(async(balanceToken) => {
            if (balanceToken > 0) {
                await getGasPrice(rpc).then(async(gasPrice) => {
                    gasPrice = (parseFloat(gasPrice * 1.2).toFixed(9)).toString();
                    /*await checkAllowance(rpc, tokens[i], address, router).then(async(allowance) => {
                        if (Number(allowance) < balanceToken) {
                            await dataApprove(rpc, tokens[i], router, address).then(async(res) => {
                                await sendEVMTX(rpc, 0, res.estimateGas, tokens[i], null, res.encodeABI, privateKey, gasPrice);
                                logger.log(`Approve ${token} for Harmony Bridge`);
                                console.log(chalk.magentaBright(`Approve ${token} for Harmony Bridge`));
                            })
                        }
                    });
                    await timeout(pauseTime);*/

                    await feeBridgeCadabra(rpc, dstChain, balanceToken, router, 2, 100000, '0', address).then(async(bridgeFee) => {
                        await lzAdapterParamsToBytes(2, 100000, 0, address).then(async(adapterParams) => {
                            await dataBridgeCadabara(rpc, balanceToken, dstChain, adapterParams, bridgeFee, router, address).then(async(res) => {
                                await sendEVMTX(rpc, 0, res.estimateGas, router, bridgeFee, res.encodeABI, privateKey, gasPrice);
                                logger.log(`Bridge All MIM from Moonbeam to Fantom`);
                                console.log(chalk.magentaBright(`Bridge All MIM from Moonbeam to Fantom`));
                            });
                        });
                    });
                });
            } else if (balanceToken == 0) {
                logger.log(`Balance token = 0`);
                console.log(chalk.yellow(`Balance token = 0`));
            }
        });
    } catch (err) {
        logger.log(err);
        console.log(err.message);
        return;
    }
}


//============================================================

(async() => {
    const wallet = parseFile('private.txt');
    const allStage = [
        'MAIN',
        'ALL BRIDGE',
        'POST',
        'OTHER',
        'STG',
    ];
    const mainStage = [
        'Send Fee to Optimism',
        'Bridge BTC Arbitrum -> Optimism -> Arbitrum',
        'Bridge ETH Arbitrum -> Optimism -> Arbitrum',
        //'Random Bridge BTC/ETH Arbitrum -> Optimism -> Arbitrum', //NEED CHANGE*/
        'Main RANDOM',
        'Swap ETH -> BTCb Arbitrum',
    ];
    const allBridge = [
        'Bridge BTC from Arbitrum to Optimism',
        'Bridge BTC from Optimism to Arbitrum',
        'Bridge ETH from Arbitrum to Optimism',
        'Bridge ETH from Optimism to Arbitrum',
        'Bridge BTC from Arbitrum to Polygon',
        'Bridge BTC from Polygon to Arbitrum',
        'Bridge BTC from Arbitrum to BSC',
        'Bridge BTC from BSC to Arbitrum',
        'Bridge BTC from Arbitrum to Avalanche',
        'Bridge BTC from Avalanche to Arbitrum',
    ];
    const postStage = [
        'Swap All BTCb -> ETH Arbitrum',
        'Bridge ALL ETH from Optimism to Arbitrum',
    ];
    const otherStage = [
        'Random Swap USDT/USDC BSC',
        'Random Swap USDT/USDC Arbitrum',
        'Bridge Token to Core',
        'Bridge Token from Core',
        'Bridge Token BSC -> Harmony',
        'Bridge Token Arbitrum -> Harmony',
        'Bridge Token from Harmony',
        'Bridge Token from BSC -> Aptos',
        'Bridge Token from Arbitrum -> Aptos',
        'Claim USDC Aptos bridge',
        'Claim USDT Aptos bridge',
        'Bridge USDC/USDT from Aptos -> BSC',
        'Bridge USDC/USDT from Aptos -> Arbitrum',
        'Swap USDC/USDT -> ETH in Arbitrum/BSC',
        'Cycle BSC Swap/Core/Harmony/Swap',
        'Cycle Arbitrum Swap/Harmony/Swap',
        'FIRST Func swap/core/bsc',
        'SECOND Func harmony/bsc/swap',
    ];
    const stgStage = [
        'Swap ETH -> STG in Random Chain',
        'Swap ETH -> STG Arbitrum Amount',
        'Stake STG',
        'Check Stake Amount',
        'Swap ETH -> STG Arbitrum Amount',
        //'Unstake STG',
        'Swap FTM -> MIM',
        'Swap MIM -> FTM',
        'Bridge MIM to Moonriver',
        'Bridge MIM to Moonriver CYCLES Random',
        'Bridge MIM to Fantom',
    ];

    const index = readline.keyInSelect(allStage, 'Choose stage!');
    let index1;
    let index2;
    let index3;
    let index4;
    let index5;
    if (index == -1) { process.exit() };
    console.log(chalk.green(`Start ${allStage[index]}`));
    logger.log(`Start ${allStage[index]}`);
    if (index == 0) {
        index1 = readline.keyInSelect(mainStage, 'Choose stage!');
        if (index1 == -1) { process.exit() };
        console.log(chalk.green(`Start ${mainStage[index1]}`));
        logger.log(`Start ${mainStage[index1]}`);
    } else if (index == 1) {
        index2 = readline.keyInSelect(allBridge, 'Choose stage!');
        if (index2 == -1) { process.exit() };
        console.log(chalk.green(`Start ${allBridge[index2]}`));
        logger.log(`Start ${allBridge[index2]}`);
    } else if (index == 2) {
        index3 = readline.keyInSelect(postStage, 'Choose stage!');
        if (index3 == -1) { process.exit() };
        console.log(chalk.green(`Start ${postStage[index3]}`));
        logger.log(`Start ${postStage[index3]}`);
    } else if (index == 3) {
        index4 = readline.keyInSelect(otherStage, 'Choose stage!');
        if (index4 == -1) { process.exit() };
        console.log(chalk.green(`Start ${otherStage[index4]}`));
        logger.log(`Start ${otherStage[index4]}`);
    } else if (index == 4) {
        index5 = readline.keyInSelect(stgStage, 'Choose stage!');
        if (index5 == -1) { process.exit() };
        console.log(chalk.green(`Start ${stgStage[index5]}`));
        logger.log(`Start ${stgStage[index5]}`);
    }
    
    for (let i = 0; i < wallet.length; i++) {
        try {
            console.log(chalk.blue(`Wallet ${i+1}: ${privateToAddress(wallet[i])}`));
            logger.log(`Wallet ${i+1}: ${privateToAddress(wallet[i])}`);
        } catch (err) { throw new Error('Error: Add Private Keys!') };

        if (index1 == 0) { //MAIN STAGE
            await sendFeeToOptimism(wallet[i]);
        } else if (index1 == 1) {
            await circleBTCBridge(wallet[i]);
        } else if (index1 == 2) {
            await circeETHBridge(wallet[i]);
        }/* else if (index1 == 3) {
            const numberCircle = generateRandomAmount(process.env.NUMBER_CIRCLES_MIN, process.env.NUMBER_CIRCLES_MAX, 0);
            const mainPart = [circeBTCBridge, circeETHBridge];
            for(let n = 0; n < numberCircle; n++) {
                console.log(chalk.magentaBright(`Start #${n+1} Circle`));
                logger.log(`Start #${n+1} Circle`);
                shuffle(mainPart);
                for (let s = 0; s < mainPart.length; s++) {
                    await mainPart[s](wallet[i]);
                }
            }
        }*/ else if (index1 == 3) {
            await mainRandomBridge(wallet[i]);
        } else if (index1 == 4) {
            await swapETHToBTCbArbitrum(wallet[i]);
        } else if (index2 == 0) { //ALL BRIDGE
            await bridgeBTCToChain(info.rpcArbitrum, info.chainIdOptimism, 2, amountGasFromArb, 0, wallet[i]);
        } else if (index2 == 1) {
            await bridgeBTCToChain(info.rpcOptimism, info.chainIdArbitrum, 2, amountGasToArb, 0, wallet[i]);
        } else if (index2 == 2) {
            await bridgeETHToOptimism(wallet[i]);
        } else if (index2 == 3) {
            await bridgeETHToArbitrum(wallet[i]);
        } else if (index2 == 4) {
            await bridgeBTCToChain(info.rpcArbitrum, info.chainIdPolygon, 2, amountGasFromArb, 0, wallet[i]);
        } else if (index2 == 5) {
            await bridgeBTCToChain(info.rpcPolygon, info.chainIdArbitrum, 2, amountGasToArb, 0, wallet[i]);
        } else if (index2 == 6) {
            await bridgeBTCToChain(info.rpcArbitrum, info.chainIdBSC, 2, amountGasFromArb, 0, wallet[i]);
        } else if (index2 == 7) {
            await bridgeBTCToChain(info.rpcBSC, info.chainIdArbitrum, 2, amountGasToArb, 0, wallet[i]);
        } else if (index2 == 8) {
            await bridgeBTCToChain(info.rpcArbitrum, info.chainIdAvalanche, 2, amountGasFromArb, 0, wallet[i]);
        } else if (index2 == 9) {
            await approveBridgeAvalanche(wallet[i]);
            await bridgeBTCToChain(info.rpcAvalanche, info.chainIdArbitrum, 2, amountGasToArb, 0, wallet[i]);
        } else if (index3 == 0) { //POST
            await swapBTCbToETHArbitrum(wallet[i]);
        } else if (index3 == 1) {
            await bridgeAllETHToArbitrum(wallet[i]);
        } else if (index4 == 0) { //OTHER
            await swapETHToTokenRandomBSC(wallet[i]);
        } else if (index4 == 1) {
            await swapETHToTokenRandomARB(wallet[i]);
        } else if (index4 == 2) {
            const arrToken = [info.bscUSDT, info.bscUSDC];
            await bridgeTokenToCore(arrToken, wallet[i]);
        } else if (index4 == 3) {
            await bridgeTokenFromCore(wallet[i]);
        } else if (index4 == 4) {
            const arrChains = [info.rpcBSC];
            const arrToken = [info.bscUSDC, info.bscUSDT];
            await bridgeTokenToHarmony(arrChains, arrToken, wallet[i]);
        } else if (index4 == 5) {
            const arrChains = [info.rpcArbitrum];
            const arrToken = [info.arbUSDC, info.arbUSDT];
            await bridgeTokenToHarmony(arrChains, arrToken, wallet[i]);
        } else if (index4 == 6) {
            await bridgeTokenFromHarmony(wallet[i]);
        } else if (index4 == 7) {
            await bridgeTokenToAptos(info.rpcBSC, wallet[i]);
        } else if (index4 == 8) {
            await bridgeTokenToAptos(info.rpcArbitrum, wallet[i]);
        } else if (index4 == 9) {
            await claimAllTokenAptos('USDC', wallet[i]);
        } else if (index4 == 10) {
            await claimAllTokenAptos('USDT', wallet[i]);
        } else if (index4 == 11) {
            await bridgeTokenFromAptos(info.chainIdBSC, wallet[i]);
        } else if (index4 == 12) {
            await bridgeTokenFromAptos(info.chainIdArbitrum, wallet[i]);
        } else if (index4 == 13) {
            await swapAllTokenInETH(wallet[i]);
        } else if (index4 == 14) {
            await mainFunc('BSC', wallet[i]);
        } else if (index4 == 15) {
            await mainFunc('Arbitrum', wallet[i]);
        } else if (index4 == 16) {
            await firstFunc(wallet[i]);
        } else if (index4 == 17) {
            await secondFunc(wallet[i]);
        } 

        if (index5 == 0) {
            await swapETHToToken(wallet[i]);
        } else if (index5 == 1) {
            await swapETHToTokenAmount(wallet[i]);
        } else if (index5 == 2) {
            await stakeSTG(wallet[i]);
        } else if (index5 == 3) {
            pauseWalletTime = 0;
            await checkStakeAmount(wallet[i]);
        } else if (index5 == 4) {
            await swapETHToTokenOptimism(wallet[i]);
        } else if (index5 == 5) {
            await swapFTMToMIM(wallet[i]);
        } else if (index5 == 6) {
            await swapMIMToFTM(wallet[i]);
        } else if (index5 == 7) {
            await bridgeTokenFromFantom(wallet[i]);
        } else if (index5 == 8) {
            for (let n = 0; n < generateRandomAmount(process.env.NUMBER_CIRCLES_MIN, process.env.NUMBER_CIRCLES_MAX); n++) {
                await bridgeTokenFromFantom(wallet[i]);
                await timeout(pauseTime);
            }
        } else if (index5 == 9) {
            await bridgeTokenFromMoonriver(wallet[i]);
        }

        await timeout(pauseWalletTime);
    }
    console.log(chalk.bgMagentaBright('Process End!'));
    logger.log('Process End!');
})();