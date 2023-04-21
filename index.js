import { info,
    timeout,
    shuffle,
    parseFile,
    generateRandomAmount,
    privateToAddress } from './tools/other.js';
import { checkAllowance,
    getETHAmount,
    getAmountToken,
    dataApprove,
    getGasPrice,
    sendArbitrumTX,
    sendOptimismTX,
    sendEVMTX } from './tools/web3.js';
import { dataTraderSwapETHToToken, dataTraderSwapTokenToETH  } from './tools/DEX.js';
import { lzAdapterParamsToBytes, feeBridgeBTC, dataBridgeBTC } from './tools/bridgeBTC.js';
import { feeBridgeStargate, dataBridgeETH } from './tools/bridgeETH.js';
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

const circeBTCBridge = async(privateKey) => {
    console.log(chalk.cyan('Start Bridge BTC Arbitrum -> Optimism -> Arbitrum'));
    logger.log('Start Bridge BTC Arbitrum -> Optimism -> Arbitrum');
    const address = privateToAddress(privateKey);
    const amountETH = parseInt(
        multiply(await getETHAmount(info.rpcArbitrum, address),
            generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MIN / 100, 3))
    );

    let isReady;
    while(!isReady) {
        //SWAP ETH -> BTCb
        console.log(chalk.yellow(`Check BTCb Balance`));
        logger.log(`Check BTCb Balance`);
        try {
            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(balanceBTCb) => {
                if (balanceBTCb == 0) {
                    console.log(chalk.yellow(`Swap ${amountETH / 10**18}ETH -> BTCb`));
                    logger.log(`Swap ${amountETH / 10**18}ETH -> BTCb`);
                    await dataTraderSwapETHToToken(info.rpcArbitrum, info.BTCb, info.WETHBTCBLPArbitrum, amountETH, address, slippage).then(async(res) => {
                        await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                            await sendArbitrumTX(info.rpcArbitrum, res.estimateGas, gasPrice, gasPrice, info.traderJoeArbitrumRouter, amountETH, res.encodeABI, privateKey);
                        });
                    });

                    await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(res) => {
                        if (res == 0) {
                            console.log(chalk.red(`Error Swap ETH -> BTCb, try again`));
                            logger.log(`Error Swap ETH -> BTCb, try again`);
                        } else if (res > 0) {
                            isReady = true;
                            console.log(chalk.magentaBright(`Swap ETH -> BTCb Successful`));
                            logger.log(`Swap ETH -> BTCb Successful`);
                            await timeout(pauseTime);
                        }
                    });
                } else if (balanceBTCb > 0) {
                    console.log(chalk.magentaBright(`Balance BTCb: ${balanceBTCb / 10**8}`));
                    logger.log(`Balance BTCb: ${balanceBTCb / 10**8}`);
                    isReady = true;
                }
            });
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }

    isReady = false;
    while(!isReady) {
        //BRIDGE BTCB TO OPTIMISM
        console.log(chalk.yellow(`Bridge BTCb Arbitrum -> Optimism`));
        logger.log(`Bridge BTCb Arbitrum -> Optimism`);

        try {
            await bridgeBTCToChain(info.rpcArbitrum, info.chainIdOptimism, 2, amountGasFromArb, 0, 2, privateKey);
            isReady = true;
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }

    isReady = false;
    while(!isReady) {
        //BRIDGE BTCB TO ARBITRUM
        console.log(chalk.yellow(`Bridge BTCb Optimism -> Arbitrum`));
        logger.log(`Bridge BTCb Optimism -> Arbitrum`);

        try {
            await getAmountToken(info.rpcOptimism, info.BTCb, address).then(async(balanceBTCb) => {
                if (balanceBTCb == 0) {
                    console.log(`Wait for BTCb on Optimism [~4min : Update every 2min]`);
                    logger.log(`Wait for BTCb on Optimism [~4min : Update every 2min]`);
                    await timeout(120000);
                } else if (balanceBTCb > 0) {
                    console.log(chalk.magentaBright(`Start send ${balanceBTCb / 10**8}BTCb to Arbitrum`));
                    logger.log(`Start send ${balanceBTCb / 10**8}BTCb to Arbitrum`);
                    await bridgeBTCToChain(info.rpcOptimism, info.chainIdArbitrum, 2, amountGasToArb, 0, 0, privateKey);
                    isReady = true;
                }
            });
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }

    isReady = false;
    while(!isReady) {
        //CHECK BTCB ON ARBITRUM
        await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(balanceBTCb) => {
            if (balanceBTCb == 0) {
                console.log(`Wait for BTCb on Arbitrum [~4min : Update every 2min]`);
                logger.log(`Wait for BTCb on Arbitrum [~4min : Update every 2min]`);
                await timeout(120000);
            } else if (balanceBTCb > 0) {
                console.log(chalk.magentaBright(`Receiving ${balanceBTCb/10**6}BTCb on Arbitrum was successful`));
                logger.log(`Receiving ${balanceBTCb/10**6}BTCb on Arbitrum was successful`);
                isReady = true;
            }
        });
    }

    isReady = false;
    while(!isReady) {
        //APPROVE BTCb for Router
        console.log(chalk.yellow(`Approve BTCb TraderJoe`));
        logger.log(`Approve BTCb TraderJoe`);
        try {
            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(amountBTCb) => {
                await checkAllowance(info.rpcArbitrum, info.BTCb, address, info.traderJoeArbitrumRouter).then(async(res) => {
                    if (Number(res) < amountBTCb) {
                        console.log(chalk.yellow(`Start Approve BTCb for Router`));
                        logger.log(`Start Approve BTCb for Router`);
                        await dataApprove(info.rpcArbitrum, info.BTCb, info.traderJoeArbitrumRouter, address).then(async(res1) => {
                            await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                                await sendArbitrumTX(info.rpcArbitrum, res1.estimateGas, gasPrice, gasPrice, info.BTCb, null, res1.encodeABI, privateKey);
                            });
                        });
                        
                    } else if (Number(res) >= amountBTCb) {
                        isReady = true;
                        console.log(chalk.magentaBright(`Approve BTCb Successful`));
                        logger.log(`Approve BTCb Successful`);
                        await timeout(pauseTime);
                    }
                });
            });
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }

    isReady = false;
    while(!isReady) {
        //Swap BTCb -> ETH
        try {
            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(amountBTCb) => {
                await dataTraderSwapTokenToETH(info.rpcArbitrum, info.BTCb, info.WETHBTCBLPArbitrum, amountBTCb, address, slippage).then(async(res) => {
                    await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                        await sendArbitrumTX(info.rpcArbitrum, res.estimateGas, gasPrice, gasPrice, info.traderJoeArbitrumRouter, null, res.encodeABI, privateKey);
                    });
                });
            })

            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(res) => {
                if (res > 0) {
                    console.log(chalk.red(`Error Swap BTCb -> ETH, try again`));
                    logger.log(`Error Swap BTCb -> ETH, try again`);
                } else if (res == 0) {
                    isReady = true;
                    console.log(chalk.magentaBright(`Swap BTCb -> ETH Successful`));
                    logger.log(`Swap BTCb -> ETH Successful`);
                    await timeout(pauseTime);
                }
            });
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }

    return true;
}

const circeETHBridge = async(privateKey) => {
    console.log(chalk.cyan('Start Bridge ETH Arbitrum -> Optimism -> Arbitrum'));
    logger.log('Start Bridge ETH Arbitrum -> Optimism -> Arbitrum');
    const address = privateToAddress(privateKey);
    let amountETH = parseInt(
        multiply(await getETHAmount(info.rpcArbitrum, address),
            generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MIN / 100, 3))
    );

    let isReady;
    let i = 0;
    while(!isReady) {
        //BRIDGE ETH TO OPTIMISM
        console.log(chalk.yellow(`Bridge ${amountETH / 10**18}ETH Arbitrum -> Optimism`));
        logger.log(`Bridge ${amountETH / 10**18}ETH Arbitrum -> Optimism`);

        try {
            await feeBridgeStargate(info.rpcArbitrum, 111, info.StargateRouterArbitrum, 0, 0, address).then(async(bridgeFee) => {
                const value = add(amountETH, bridgeFee);
                await dataBridgeETH(info.rpcArbitrum, 111, amountETH, value, info.ETHRouterArbitrum, address).then(async(res) => {
                    await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                        gasPrice = (parseFloat(gasPrice * 1.5).toFixed(5)).toString();
                        await sendArbitrumTX(info.rpcArbitrum, res.estimateGas, gasPrice, gasPrice, info.ETHRouterArbitrum, value, res.encodeABI, privateKey);
                        isReady = true;
                    });
                });
            });
        } catch (err) {
            i = i + 1;
            logger.log(err.message);
            console.log(err.message);
            if (i == 3) {
                i = 0;
                throw new Error(err);
            }
            await timeout(pauseTime);
        }
    }

    isReady = false;
    while(!isReady) {
        //BRIDGE ETH TO ARBITRUM
        console.log(chalk.yellow(`Bridge ETH Optimism -> Arbitrum`));
        logger.log(`Bridge ETH Optimism -> Arbitrum`);

        try {
            await getETHAmount(info.rpcOptimism, address).then(async(balanceETH) => {
                if (balanceETH < process.env.AMOUNT_TO_START * 10**18) {
                    console.log(`Wait for ETH on Optimism [~2min : Update every 1min]`);
                    logger.log(`Wait for ETH on Optimism [~2min : Update every 1min]`);
                    await timeout(60000);
                } else if (balanceETH >= process.env.AMOUNT_TO_START * 10**18) {
                    await feeBridgeStargate(info.rpcOptimism, 110, info.StargateRouterOptimism, 0, 0, address).then(async(bridgeFee) => {
                        amountETH = parseInt(
                            multiply(balanceETH, generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MIN / 100, 3))
                        );
                        console.log(chalk.magentaBright(`Start send ${amountETH / 10**18}ETH to Arbitrum`));
                        logger.log(`Start send ${amountETH / 10**18}ETH to Arbitrum`);

                        const value = add(amountETH, bridgeFee);
                        await dataBridgeETH(info.rpcOptimism, 110, amountETH, value, info.ETHRouterOptimism, address).then(async(res) => {
                            await getGasPrice(info.rpcOptimism).then(async(gasPrice) => {
                                gasPrice = (parseFloat(gasPrice * 1.5).toFixed(5)).toString();
                                await sendOptimismTX(info.rpcOptimism, res.estimateGas, gasPrice, info.ETHRouterOptimism, value, res.encodeABI, privateKey);
                                isReady = true;
                            });
                        });
                    });
                }
            });
        } catch (err) {
            i = i + 1;
            logger.log(err.message);
            console.log(err.message);
            if (i == 3) {
                i = 0;
                throw new Error(err);
            }
            await timeout(pauseTime);
        }
    }

    isReady = false;
    while(!isReady) {
        //CHECK ETH ON ARBITRUM
        await getETHAmount(info.rpcArbitrum, address).then(async(balanceETH) => {
            if (balanceETH < process.env.AMOUNT_TO_START * 10**18) {
                console.log(chalk`Wait for ETH on Arbitrum [~2min : Update every 1min]`);
                logger.log(`Wait for ETH on Arbitrum [~2min : Update every 1min]`);
                await timeout(60000);
            } else if (balanceETH >= process.env.AMOUNT_TO_START * 10**18) {
                console.log(chalk.magentaBright(`Receiving ${balanceETH/10**18}ETH on Arbitrum was successful`));
                logger.log(`Receiving ${balanceETH/10**18}ETH on Arbitrum was successful`);
                isReady = true;
            }
        });
    }

    return true;
} //NEED CHANGE

//===========================================================

const bridgeBTCToChain = async(rpcFrom, chainIdTo, lzVersion, lzGasLimit, lzNative, typeTX, privateKey) => {
    const address = privateToAddress(privateKey);
    const balanceBTCB = rpcFrom == info.rpcAvalanche ? await getAmountToken(rpcFrom, info.BTCbAvalanche, address) : await getAmountToken(rpcFrom, info.BTCb, address);
    if (balanceBTCB == 0) {
        console.log(chalk.red('Balance BTCb = 0. Skip Wallet'));
        logger.log('Balance BTCb = 0. Skip Wallet');
        return false;
    }

    try {
        await feeBridgeBTC(rpcFrom, chainIdTo, balanceBTCB, info.BTCb, lzVersion, lzGasLimit, lzNative, address).then(async(bridgeFee) => {
            await lzAdapterParamsToBytes(lzVersion, lzGasLimit, lzNative, address).then(async(adapterParams) => {
                await dataBridgeBTC(rpcFrom, balanceBTCB, chainIdTo, adapterParams, bridgeFee, info.BTCb, address).then(async(res) => {
                    await getGasPrice(rpcFrom).then(async(gasPrice) => {
                        gasPrice = (parseFloat(gasPrice * 1.2).toFixed(5)).toString();
                        let priorityFee = gasPrice;
                        if (rpcFrom == info.rpcPolygon) {
                            priorityFee = '30';
                        } else if (rpcFrom == info.rpcAvalanche) {
                            priorityFee = '1.5';
                        }
                        await sendEVMTX(rpcFrom, typeTX, res.estimateGas, info.BTCb, bridgeFee, res.encodeABI, privateKey, gasPrice, priorityFee);
                        return true;
                    });
                });
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        return;
    }
}

const approveBridgeAvalanche = async(privateKey) => {
    const address = privateToAddress(privateKey);

    let isReady;
    while(!isReady) {
        //APPROVE BTCb for Router
        console.log(chalk.yellow(`Approve BTCb`));
        logger.log(`Approve BTCb`);
        try {
            await getAmountToken(info.rpcAvalanche, info.BTCbAvalanche, address).then(async(amountBTCb) => {
                await checkAllowance(info.rpcAvalanche, info.BTCbAvalanche, address, info.BTCb).then(async(res) => {
                    if (Number(res) < amountBTCb) {
                        console.log(chalk.yellow(`Start Approve BTCb for Router`));
                        logger.log(`Start Approve BTCb for Router`);
                        await dataApprove(info.rpcAvalanche, info.BTCbAvalanche, info.BTCb, address).then(async(res1) => {
                            await getGasPrice(info.rpcAvalanche).then(async(gasPrice) => {
                                gasPrice = (parseFloat(gasPrice * 1.2).toFixed(5)).toString();
                                await sendEVMTX(info.rpcAvalanche, 2, res1.estimateGas, info.BTCb, null, res1.encodeABI, privateKey, gasPrice, '1.5');
                            });
                        });
                    } else if (Number(res) >= amountBTCb) {
                        isReady = true;
                        console.log(chalk.magentaBright(`Approve BTCb Successful`));
                        logger.log(`Approve BTCb Successful`);
                        await timeout(pauseTime);
                    }
                });
            });
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }
}

const mainRandomBridge = async(privateKey) => {
    console.log(chalk.cyan('Start Random Bridge BTC'));
    logger.log('Start Random Bridge BTC');
    const address = privateToAddress(privateKey);
    const amountETH = parseInt(
        multiply(await getETHAmount(info.rpcArbitrum, address),
            generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MIN / 100, 3))
    );

    let isReady;
    while(!isReady) {
        //SWAP ETH -> BTCb
        console.log(chalk.yellow(`Check BTCb Balance`));
        logger.log(`Check BTCb Balance`);
        try {
            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(balanceBTCb) => {
                if (balanceBTCb == 0) {
                    console.log(chalk.yellow(`Swap ${amountETH / 10**18}ETH -> BTCb`));
                    logger.log(`Swap ${amountETH / 10**18}ETH -> BTCb`);
                    await dataTraderSwapETHToToken(info.rpcArbitrum, info.BTCb, info.WETHBTCBLPArbitrum, amountETH, address, slippage).then(async(res) => {
                        await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                            await sendArbitrumTX(info.rpcArbitrum, res.estimateGas, gasPrice, gasPrice, info.traderJoeArbitrumRouter, amountETH, res.encodeABI, privateKey);
                        });
                    });

                    await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(res) => {
                        if (res == 0) {
                            console.log(chalk.red(`Error Swap ETH -> BTCb, try again`));
                            logger.log(`Error Swap ETH -> BTCb, try again`);
                        } else if (res > 0) {
                            isReady = true;
                            console.log(chalk.magentaBright(`Swap ETH -> BTCb Successful`));
                            logger.log(`Swap ETH -> BTCb Successful`);
                            await timeout(pauseTime);
                        }
                    });
                } else if (balanceBTCb > 0) {
                    console.log(chalk.magentaBright(`Balance BTCb: ${balanceBTCb / 10**8}`));
                    logger.log(`Balance BTCb: ${balanceBTCb / 10**8}`);
                    isReady = true;
                }
            });
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }

    const numberChain = generateRandomAmount(process.env.NUMBER_CHAIN_MIN, process.env.NUMBER_CHAIN_MAX, 0);
    const allChains = ['Optimism', 'BSC', 'Polygon', 'Avalanche'];
    let chainNow = 'Arbitrum';
    let chainTo = allChains[generateRandomAmount(0, 3, 0)];

    for (let n = 1; n <= numberChain; n++) {
        if (n == 1) {
            console.log('STAGE 1');
            let isReady = false;
            while(!isReady) {
                console.log(chalk.yellow(`Bridge BTCb ${chainNow} -> ${chainTo}`));
                logger.log(`Bridge BTCb ${chainNow} -> ${chainTo}`);
                try {
                    const result = await bridgeBTCToChain(info.rpcArbitrum, info['chainId' + chainTo], 2, amountGasFromArb, 0, 2, privateKey);
                    if (result) {
                        chainNow = chainTo;
                        isReady = true;
                    } else { return; }
                } catch (err) {
                    logger.log(err.message);
                    console.log(err.message);
                    return;
                }
            }
        } else if (n < numberChain) {
            console.log(`STAGE 2 CIRCLE ${n - 1}`);
            isReady = false;
            while(!isReady) {
                try {
                    const token = chainNow == 'Avalanche' ? info.BTCbAvalanche : info.BTCb;
                    await getAmountToken(info['rpc' + chainNow], token, address).then(async(balanceBTCb) => {
                        if (balanceBTCb == 0) {
                            console.log(`Wait for BTCb in ${chainNow} [Update every 3min]`);
                            logger.log(`Wait for BTCb in ${chainNow} [Update every 3min]`);
                            await timeout(180000);
                        } else if (balanceBTCb > 0) {
                            shuffle(allChains);
                            chainTo = chainNow == allChains[0] ? allChains[1] : allChains[0];

                            console.log(chalk.yellow(`Bridge ${balanceBTCb / 10**8}BTCb ${chainNow} -> ${chainTo}`));
                            logger.log(`Bridge ${balanceBTCb / 10**8}BTCb ${chainNow} -> ${chainTo}`);
                            const typeTX = chainNow == 'Optimism' || chainNow == 'BSC' ? 0 : 2;
                            if (chainNow == 'Avalanche') {
                                await approveBridgeAvalanche(privateKey);
                            }
                            const result = await bridgeBTCToChain(info['rpc' + chainNow], info['chainId' + chainTo], 2, amountGasFromArb, 0, typeTX, privateKey);
                            if (result) {
                                chainNow = chainTo;
                                isReady = true;
                            } else { return; }
                        }
                    });
                } catch (err) {
                    logger.log(err.message);
                    console.log(err.message);
                    return;
                }
            }
        } else {
            console.log('STAGE 3');
            isReady = false;
            while(!isReady) {
                try {
                    const token = chainNow == 'Avalanche' ? info.BTCbAvalanche : info.BTCb;
                    await getAmountToken(info['rpc' + chainNow], token, address).then(async(balanceBTCb) => {
                        if (balanceBTCb == 0) {
                            console.log(`Wait for BTCb in ${chainNow} [Update every 3min]`);
                            logger.log(`Wait for BTCb in ${chainNow} [Update every 3min]`);
                            await timeout(180000);
                        } else if (balanceBTCb > 0) {
                            chainTo = 'Arbitrum';

                            console.log(chalk.yellow(`Bridge ${balanceBTCb / 10**8}BTCb ${chainNow} -> ${chainTo}`));
                            logger.log(`Bridge ${balanceBTCb / 10**8}BTCb ${chainNow} -> ${chainTo}`);
                            const typeTX = chainNow == 'Optimism' || chainNow == 'BSC' ? 0 : 2;
                            if (chainNow == 'Avalanche') {
                                await approveBridgeAvalanche(privateKey);
                            }
                            const result = await bridgeBTCToChain(info['rpc' + chainNow], info['chainId' + chainTo], 2, amountGasToArb, 0, typeTX, privateKey);
                            if (result) {
                                chainNow = chainTo;
                                isReady = true;
                            } else { return; }
                        }
                    });
                } catch (err) {
                    logger.log(err.message);
                    console.log(err.message);
                    return;
                }
            }
        }
    }

    isReady = false;
    while(!isReady) {
        //CHECK BTCB ON ARBITRUM
        await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(balanceBTCb) => {
            if (balanceBTCb == 0) {
                console.log(`Wait for BTCb on Arbitrum [~4min : Update every 2min]`);
                logger.log(`Wait for BTCb on Arbitrum [~4min : Update every 2min]`);
                await timeout(120000);
            } else if (balanceBTCb > 0) {
                console.log(chalk.magentaBright(`Receiving ${balanceBTCb/10**8}BTCb on Arbitrum was successful`));
                logger.log(`Receiving ${balanceBTCb/10**8}BTCb on Arbitrum was successful`);
                isReady = true;
            }
        });
    }

    isReady = false;
    while(!isReady) {
        //APPROVE BTCb for Router
        console.log(chalk.yellow(`Approve BTCb TraderJoe`));
        logger.log(`Approve BTCb TraderJoe`);
        try {
            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(amountBTCb) => {
                await checkAllowance(info.rpcArbitrum, info.BTCb, address, info.traderJoeArbitrumRouter).then(async(res) => {
                    if (Number(res) < amountBTCb) {
                        console.log(chalk.yellow(`Start Approve BTCb for Router`));
                        logger.log(`Start Approve BTCb for Router`);
                        await dataApprove(info.rpcArbitrum, info.BTCb, info.traderJoeArbitrumRouter, address).then(async(res1) => {
                            await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                                await sendArbitrumTX(info.rpcArbitrum, res1.estimateGas, gasPrice, gasPrice, info.BTCb, null, res1.encodeABI, privateKey);
                            });
                        });
                        
                    } else if (Number(res) >= amountBTCb) {
                        isReady = true;
                        console.log(chalk.magentaBright(`Approve BTCb Successful`));
                        logger.log(`Approve BTCb Successful`);
                        await timeout(pauseTime);
                    }
                });
            });
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }

    isReady = false;
    while(!isReady) {
        //Swap BTCb -> ETH
        try {
            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(amountBTCb) => {
                await dataTraderSwapTokenToETH(info.rpcArbitrum, info.BTCb, info.WETHBTCBLPArbitrum, amountBTCb, address, slippage).then(async(res) => {
                    await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                        await sendArbitrumTX(info.rpcArbitrum, res.estimateGas, gasPrice, gasPrice, info.traderJoeArbitrumRouter, null, res.encodeABI, privateKey);
                    });
                });
            })

            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(res) => {
                if (res > 0) {
                    console.log(chalk.red(`Error Swap BTCb -> ETH, try again`));
                    logger.log(`Error Swap BTCb -> ETH, try again`);
                } else if (res == 0) {
                    isReady = true;
                    console.log(chalk.magentaBright(`Swap BTCb -> ETH Successful`));
                    logger.log(`Swap BTCb -> ETH Successful`);
                    await timeout(pauseTime);
                }
            });
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }

    return true;
}

//============================================================

const swapBTCBToETH = async(privateKey) => {
    const address = privateToAddress(privateKey);

    let isReady;
    while(!isReady) {
        //APPROVE BTCb for Router
        console.log(chalk.yellow(`Approve BTCb TraderJoe`));
        logger.log(`Approve BTCb TraderJoe`);
        try {
            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(amountBTCb) => {
                await checkAllowance(info.rpcArbitrum, info.BTCb, address, info.traderJoeArbitrumRouter).then(async(res) => {
                    if (Number(res) < amountBTCb) {
                        console.log(chalk.yellow(`Start Approve BTCb for Router`));
                        logger.log(`Start Approve BTCb for Router`);
                        await dataApprove(info.rpcArbitrum, info.BTCb, info.traderJoeArbitrumRouter, address).then(async(res1) => {
                            await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                                await sendArbitrumTX(info.rpcArbitrum, res1.estimateGas, gasPrice, gasPrice, info.BTCb, null, res1.encodeABI, privateKey);
                            });
                        });
                    } else if (Number(res) >= amountBTCb) {
                        isReady = true;
                        console.log(chalk.magentaBright(`Approve BTCb Successful`));
                        logger.log(`Approve BTCb Successful`);
                        await timeout(pauseTime);
                    }
                });
            });
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }

    isReady = false;
    while(!isReady) {
        //Swap BTCb -> ETH
        try {
            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(amountBTCb) => {
                await dataTraderSwapTokenToETH(info.rpcArbitrum, info.BTCb, info.WETHBTCBLPArbitrum, amountBTCb, address, slippage).then(async(res) => {
                    await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                        await sendArbitrumTX(info.rpcArbitrum, res.estimateGas, gasPrice, gasPrice, info.traderJoeArbitrumRouter, null, res.encodeABI, privateKey);
                    });
                });
            })

            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(res) => {
                if (res > 0) {
                    console.log(chalk.red(`Error Swap BTCb -> ETH, try again`));
                    logger.log(`Error Swap BTCb -> ETH, try again`);
                } else if (res == 0) {
                    isReady = true;
                    console.log(chalk.magentaBright(`Swap BTCb -> ETH Successful`));
                    logger.log(`Swap BTCb -> ETH Successful`);
                    await timeout(pauseTime);
                }
            });
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            return;
        }
    }
}

const bridgeETHToOptimism = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const amountETH = parseInt(
        multiply(await getETHAmount(info.rpcArbitrum, address),
            generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MIN / 100, 3))
    );

    try{
        await feeBridgeStargate(info.rpcArbitrum, 111, info.StargateRouterArbitrum, 0, 0, address).then(async(bridgeFee) => {
            const value = add(amountETH, bridgeFee);
            await dataBridgeETH(info.rpcArbitrum, 111, amountETH, value, info.ETHRouterArbitrum, address).then(async(res) => {
                await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                    gasPrice = (parseFloat(gasPrice * 1.5).toFixed(5)).toString();
                    await sendArbitrumTX(info.rpcArbitrum, res.estimateGas, gasPrice, gasPrice, info.ETHRouterArbitrum, value, res.encodeABI, privateKey);
                });
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        return;
    }
}

const bridgeETHToArbitrum = async(privateKey) => {
    const address = privateToAddress(privateKey);
    
    try{
        await getETHAmount(rpc.rpcOptimism, address).then(async(balanceETH) => {
            const amountETH = subtract(balanceETH, generateRandomAmount(process.env.ETH_BRIDGE_MIN * 10**18, process.env.ETH_BRIDGE_MAX * 10**18, 0));
            if (Number(amountETH) > 0) {
                await feeBridgeStargate(info.rpcOptimism, 110, info.StargateRouterOptimism, 0, 0, address).then(async(bridgeFee) => {
                    const value = add(amountETH, bridgeFee);
                    await dataBridgeETH(info.rpcOptimism, 110, amountETH, value, info.ETHRouterOptimism, address).then(async(res) => {
                        await getGasPrice(info.rpcOptimism).then(async(gasPrice) => {
                            gasPrice = (parseFloat(gasPrice * 1.5).toFixed(5)).toString();
                            await sendEVMTX(info.rpcOptimism, 0, res.estimateGas, info.ETHRouterOptimism, value, res.encodeABI, privateKey, gasPrice);
                        });
                    });
                });
            } else if (Number(amountETH) < 0) {
                throw new Error(`Wallet ${address} no ether to send`);
            }
        }); 
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        return;
    }
}

const bridgeAllETHToArbitrum = async(privateKey) => {
    const address = privateToAddress(privateKey);
    let amountETH = parseInt(
        multiply(await getETHAmount(info.rpcOptimism, address),
            generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MIN / 100, 3))
    );

    try{
        await getETHAmount(info.rpcOptimism, address).then(async(balanceETH) => {
            await getGasPrice(info.rpcETH).then(async(gasPriceETH) => {
                await feeBridgeStargate(info.rpcOptimism, 110, info.StargateRouterOptimism, 0, 0, address).then(async(bridgeFee) => {
                    const value = add(amountETH, bridgeFee);
                    await dataBridgeETH(info.rpcOptimism, 110, amountETH, value, info.ETHRouterOptimism, address).then(async(res) => {
                        await getGasPrice(info.rpcOptimism).then(async(gasPriceOP) => {
                            gasPriceETH = (parseFloat(gasPriceETH * 1.5).toFixed(5)).toString();
                            gasPriceOP = (parseFloat(gasPriceOP * 1.5).toFixed(5)).toString();
                            const amountFee = parseInt(add(multiply(gasPriceOP * 10**9, res.estimateGas), multiply(gasPriceETH * 10**9, 6000)));
                            console.log(amountFee);
                            await feeBridgeStargate(info.rpcOptimism, 110, info.StargateRouterOptimism, 0, 0, address).then(async(bridgeFee) => {
                                amountETH = subtract(balanceETH, add(amountFee, bridgeFee));
                                console.log(amountETH);
                                const value = add(amountETH, bridgeFee);
                                await dataBridgeETH(info.rpcOptimism, 110, amountETH, value, info.ETHRouterOptimism, address).then(async(res1) => {
                                    await sendOptimismTX(info.rpcOptimism, res1.estimateGas, gasPriceOP, info.ETHRouterOptimism, value, res1.encodeABI, privateKey);
                                });
                            }); 
                        });
                    });
                });
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        return;
    }
}

//============================================================

const withdrawETHToSubWalletArbitrum = async(toAddress, privateKey) => {
    const addressETH = privateToAddress(privateKey);

    try {
        await getETHAmount(info.rpcArbitrum, addressETH).then(async(amountETH) => {
            await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                gasPrice = (parseFloat(multiply(gasPrice, 1.2)).toFixed(5)).toString();
                amountETH = subtract(amountETH, 1100000 * multiply(gasPrice, 10**9));
                await sendEVMTX(info.rpcArbitrum, 2, generateRandomAmount(900000, 1000000, 0), toAddress, amountETH, null, privateKey, gasPrice, gasPrice);
                
                console.log(chalk.yellow(`Send ${amountETH / 10**18}ETH to ${toAddress} Arbitrum`));
                logger.log(`Send ${amountETH / 10**18}ETH to ${toAddress} Arbitrum`);
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        return;
    }
}

const withdrawETHToSubWalletBSC = async(toAddress, privateKey) => {
    const addressETH = privateToAddress(privateKey);

    try {
        await getETHAmount(info.rpcBSC, addressETH).then(async(amountETH) => {
            gasPrice = '5';
            amountETH = subtract(amountETH, 21000 * multiply(5.1, 10**9));
            await sendEVMTX(info.rpcBSC, 0, 21000, toAddress, amountETH, null, privateKey, gasPrice);
            
            console.log(chalk.yellow(`Send ${amountETH / 10**18}ETH to ${toAddress} BSC`));
            logger.log(`Send ${amountETH / 10**18}ETH to ${toAddress} BSC`);
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        return;
    }
}

const withdrawETHToSubWalletPolygon = async(toAddress, privateKey) => {
    const addressETH = privateToAddress(privateKey);

    try {
        await getETHAmount(info.rpcPolygon, addressETH).then(async(amountETH) => {
            await getGasPrice(info.rpcPolygon).then(async(gasPrice) => {
                gasPrice = (parseFloat(multiply(gasPrice, 1.5)).toFixed(5)).toString();
                amountETH = subtract(amountETH, 21000 * multiply(add(gasPrice, 30), 10**9));
                await sendEVMTX(info.rpcPolygon, 2, 21000, toAddress, amountETH, null, privateKey, gasPrice, '30');
                
                console.log(chalk.yellow(`Send ${amountETH / 10**18}ETH to ${toAddress} Polygon`));
                logger.log(`Send ${amountETH / 10**18}ETH to ${toAddress} Polygon`);
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        return;
    }
}

const withdrawETHToSubWalletAvalanche = async(toAddress, privateKey) => {
    const addressETH = privateToAddress(privateKey);

    try {
        await getETHAmount(info.rpcAvalanche, addressETH).then(async(amountETH) => {
            await getGasPrice(info.rpcAvalanche).then(async(gasPrice) => {
                gasPrice = (parseFloat(multiply(gasPrice, 1.5)).toFixed(5)).toString();
                amountETH = subtract(amountETH, 21000 * multiply(gasPrice, 10**9));
                await sendEVMTX(info.rpcAvalanche, 0, 21000, toAddress, amountETH, null, privateKey, gasPrice);
                
                console.log(chalk.yellow(`Send ${amountETH / 10**18}ETH to ${toAddress} Avalanche`));
                logger.log(`Send ${amountETH / 10**18}ETH to ${toAddress} Avalanche`);
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        return;
    }
}

(async() => {
    const wallet = parseFile('private.txt');
    const walletOKX = parseFile('subWallet.txt');
    const allStage = [
        'MAIN',
        'ALL BRIDGE',
        'POST',
        'OTHER'
    ];
    const mainStage = [
        'Send Fee to Optimism',
        /*'Bridge BTC Arbitrum -> Optimism -> Arbitrum',
        'Bridge ETH Arbitrum -> Optimism -> Arbitrum',
        'Random Bridge BTC/ETH Arbitrum -> Optimism -> Arbitrum', //NEED CHANGE*/
        'Main RANDOM',
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
        'Send to SubWallet Arbitrum',
        'Send to SubWallet BSC',
        'Send to SubWallet Polygon',
        'Send to SubWallet Avalanche',
    ];

    const index = readline.keyInSelect(allStage, 'Choose stage!');
    let index1;
    let index2;
    let index3;
    let index4;
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
    }
    
    for (let i = 0; i < wallet.length; i++) {
        try {
            console.log(chalk.blue(`Wallet ${i+1}: ${privateToAddress(wallet[i])}`));
            logger.log(`Wallet ${i+1}: ${privateToAddress(wallet[i])}`);
        } catch (err) { throw new Error('Error: Add Private Keys!') };

        if (index1 == 0) { //MAIN STAGE
            await sendFeeToOptimism(wallet[i]);
        }/* else if (index1 == 1) {
            await circeBTCBridge(wallet[i]);
        } else if (index1 == 2) {
            await circeETHBridge(wallet[i]);
        } else if (index1 == 3) {
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
        }*/ else if (index1 == 1) {
            await mainRandomBridge(wallet[i]);
        } else if (index2 == 0) { //ALL BRIDGE
            await bridgeBTCToChain(info.rpcArbitrum, info.chainIdOptimism, 2, amountGasFromArb, 0, 2, wallet[i]);
        } else if (index2 == 1) {
            await bridgeBTCToChain(info.rpcOptimism, info.chainIdArbitrum, 2, amountGasToArb, 0, 0, wallet[i]);
        } else if (index2 == 2) {
            await bridgeETHToOptimism(wallet[i]);
        } else if (index2 == 3) {
            await bridgeETHToArbitrum(wallet[i]);
        } else if (index2 == 4) {
            await bridgeBTCToChain(info.rpcArbitrum, info.chainIdPolygon, 2, amountGasFromArb, 0, 2, wallet[i]);
        } else if (index2 == 5) {
            await bridgeBTCToChain(info.rpcPolygon, info.chainIdArbitrum, 2, amountGasToArb, 0, 2, wallet[i]);
        } else if (index2 == 6) {
            await bridgeBTCToChain(info.rpcArbitrum, info.chainIdBSC, 2, amountGasFromArb, 0, 2, wallet[i]);
        } else if (index2 == 7) {
            await bridgeBTCToChain(info.rpcBSC, info.chainIdArbitrum, 2, amountGasToArb, 0, 0, wallet[i]);
        } else if (index2 == 8) {
            await bridgeBTCToChain(info.rpcArbitrum, info.chainIdAvalanche, 2, amountGasFromArb, 0, 2, wallet[i]);
        } else if (index2 == 9) {
            await approveBridgeAvalanche(wallet[i]);
            await bridgeBTCToChain(info.rpcAvalanche, info.chainIdArbitrum, 2, amountGasToArb, 0, 2, wallet[i]);
        } else if (index3 == 0) { //POST
            await swapBTCBToETH(wallet[i]);
        } else if (index3 == 1) {
            await bridgeAllETHToArbitrum(wallet[i]);
        } else if (index4 == 0) { //OTHER
            await withdrawETHToSubWalletArbitrum(walletOKX[i], wallet[i]);
        } else if (index4 == 1) {
            await withdrawETHToSubWalletBSC(walletOKX[i], wallet[i]);
        } else if (index4 == 2) {
            await withdrawETHToSubWalletPolygon(walletOKX[i], wallet[i]);
        } else if (index4 == 3) {
            await withdrawETHToSubWalletAvalanche(walletOKX[i], wallet[i]);
        }

        await timeout(pauseWalletTime);
    }
    console.log(chalk.bgMagentaBright('Process End!'));
    logger.log('Process End!');
})();