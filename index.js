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
    sendOptimismTX } from './tools/web3.js';
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

const getAllFeeOptimism = async() => {
    const addressExample = process.env.ADDRESS_EXAMPLE
    const numberCircles = (process.env.NUMBER_CIRCLES_MAX * 2);
    
    const amountFeeBTCBridge = await feeBridgeBTC(info.rpcOptimism, 110, '1', info.BTCb, 2, 3000000, 0, addressExample);
    const amountFeeETHBridge = await feeBridgeStargate(info.rpcOptimism, 110, info.StargateRouterOptimism, 0, 0, addressExample);
    const random = generateRandomAmount(1.7, 2.1, 3);
    const amountFeeAll = parseInt(multiply(add(amountFeeBTCBridge, amountFeeETHBridge), numberCircles, random));
    
    return amountFeeAll;
}

const sendFeeToOptimism = async(privateKey) => {
    const address = privateToAddress(privateKey);

    try{
        const amountETH = await getAllFeeOptimism();
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
        await timeout(pauseTime);
    }
}

const circeBTCBridge = async(privateKey) => {
    console.log(chalk.cyan('Start Bridge BTC Arbitrum -> Optimism -> Arbitrum'));
    logger.log('Start Bridge BTC Arbitrum -> Optimism -> Arbitrum');
    const address = privateToAddress(privateKey);
    const amountETH = parseInt(
        multiply(await getETHAmount(info.rpcArbitrum, address),
            generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MIN / 100, 3))
    );

    let isReady;
    let i = 0;
    while(!isReady) {
        //SWAP ETH -> BTCb
        console.log(chalk.yellow(`Check BTCb Balance`));
        logger.log(`Check BTCb Balance`);
        await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(balanceBTCb) => {
            if (balanceBTCb == 0) {
                console.log(chalk.yellow(`Swap ${amountETH / 10**18}ETH -> BTCb`));
                logger.log(`Swap ${amountETH / 10**18}ETH -> BTCb`);
                try {
                    await dataTraderSwapETHToToken(info.rpcArbitrum, info.BTCb, info.WETHBTCBLPArbitrum, amountETH, address, slippage).then(async(res) => {
                        await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                            await sendArbitrumTX(info.rpcArbitrum, res.estimateGas, gasPrice, gasPrice, info.traderJoeArbitrumRouter, amountETH, res.encodeABI, privateKey);
                        });
                    });
                } catch (err) {
                    logger.log(err.message);
                    console.log(err.message);
                    await timeout(pauseTime);
                }

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
                console.log(chalk.magentaBright(`Balance BTCb: ${balanceBTCb/10**6}`));
                logger.log(`Balance BTCb: ${balanceBTCb/10**6}`);
                isReady = true;
            }
        });
    }

    isReady = false;
    while(!isReady) {
        //BRIDGE BTCB TO OPTIMISM
        console.log(chalk.yellow(`Bridge BTCb Arbitrum -> Optimism`));
        logger.log(`Bridge BTCb Arbitrum -> Optimism`);

        try {
            await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(balanceBTCb) => {
                await feeBridgeBTC(info.rpcArbitrum, 111, balanceBTCb, info.BTCb, 2, 400000, 0, address).then(async(bridgeFee) => {
                    await lzAdapterParamsToBytes(2, 400000, 0, address).then(async(adapterParams) => {
                        await dataBridgeBTC(info.rpcArbitrum, balanceBTCb, 111, adapterParams, bridgeFee, info.BTCb, address).then(async(res) => {
                            await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                                gasPrice = (parseFloat(gasPrice * 1.5).toFixed(5)).toString();
                                await sendArbitrumTX(info.rpcArbitrum, res.estimateGas, gasPrice, gasPrice, info.BTCb, bridgeFee, res.encodeABI, privateKey);
                                isReady = true;
                            });
                        });
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
        //BRIDGE BTCB TO ARBITRUM
        console.log(chalk.yellow(`Bridge BTCb Optimism -> Arbitrum`));
        logger.log(`Bridge BTCb Optimism -> Arbitrum`);

        try {
            await getAmountToken(info.rpcOptimism, info.BTCb, address).then(async(balanceBTCb) => {
                if (balanceBTCb == 0) {
                    console.log(`Wait for BTCb on Optimism [~2min : Update every 1min]`);
                    logger.log(`Wait for BTCb on Optimism [~2min : Update every 1min]`);
                    await timeout(60000);
                } else if (balanceBTCb > 0) {
                    console.log(chalk.magentaBright(`Start send ${balanceBTCb / 10**6}BTCb to Arbitrum`));
                    logger.log(`Start send ${balanceBTCb / 10**6}BTCb to Arbitrum`);
                    await feeBridgeBTC(info.rpcOptimism, 110, balanceBTCb, info.BTCb, 2, 3000000, 0, address).then(async(bridgeFee) => {
                        await lzAdapterParamsToBytes(2, 3000000, 0, address).then(async(adapterParams) => {
                            await dataBridgeBTC(info.rpcOptimism, balanceBTCb, 110, adapterParams, bridgeFee, info.BTCb, address).then(async(res) => {
                                await getGasPrice(info.rpcOptimism).then(async(gasPrice) => {
                                    gasPrice = (parseFloat(gasPrice * 1.5)).toString();
                                    await sendOptimismTX(info.rpcOptimism, res.estimateGas, gasPrice, info.BTCb, bridgeFee, res.encodeABI, privateKey);
                                    isReady = true;
                                });
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
        //CHECK BTCB ON ARBITRUM
        await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(balanceBTCb) => {
            if (balanceBTCb == 0) {
                console.log(`Wait for BTCb on Arbitrum [~2min : Update every 1min]`);
                logger.log(`Wait for BTCb on Arbitrum [~2min : Update every 1min]`);
                await timeout(60000);
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
        await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(amountBTCb) => {
            await checkAllowance(info.rpcArbitrum, info.BTCb, address, info.traderJoeArbitrumRouter).then(async(res) => {
                if (Number(res) < amountBTCb) {
                    console.log(chalk.yellow(`Start Approve BTCb for Router`));
                    logger.log(`Start Approve BTCb for Router`);
                    try {
                        await dataApprove(info.rpcArbitrum, info.BTCb, info.traderJoeArbitrumRouter, address).then(async(res1) => {
                            await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                                await sendArbitrumTX(info.rpcArbitrum, res1.estimateGas, gasPrice, gasPrice, info.BTCb, null, res1.encodeABI, privateKey);
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
                        
                } else if (Number(res) >= amountBTCb) {
                    isReady = true;
                    console.log(chalk.magentaBright(`Approve BTCb Successful`));
                    logger.log(`Approve BTCb Successful`);
                    await timeout(pauseTime);
                }
            });
        });
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
}

const swapBTCBToETH = async(privateKey) => {
    const address = privateToAddress(privateKey);

    let isReady;
    while(!isReady) {
        //APPROVE BTCb for Router
        console.log(chalk.yellow(`Approve BTCb TraderJoe`));
        logger.log(`Approve BTCb TraderJoe`);
        await getAmountToken(info.rpcArbitrum, info.BTCb, address).then(async(amountBTCb) => {
            await checkAllowance(info.rpcArbitrum, info.BTCb, address, info.traderJoeArbitrumRouter).then(async(res) => {
                if (Number(res) < amountBTCb) {
                    console.log(chalk.yellow(`Start Approve BTCb for Router`));
                    logger.log(`Start Approve BTCb for Router`);
                    try {
                        await dataApprove(info.rpcArbitrum, info.BTCb, info.traderJoeArbitrumRouter, address).then(async(res1) => {
                            await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                                await sendArbitrumTX(info.rpcArbitrum, res1.estimateGas, gasPrice, gasPrice, info.BTCb, null, res1.encodeABI, privateKey);
                            });
                        });
                    } catch (err) {
                        logger.log(err.message);
                        console.log(err.message);
                        await timeout(pauseTime);
                    }
                        
                } else if (Number(res) >= amountBTCb) {
                    isReady = true;
                    console.log(chalk.magentaBright(`Approve BTCb Successful`));
                    logger.log(`Approve BTCb Successful`);
                    await timeout(pauseTime);
                }
            });
        });
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
        } catch (err) {
            logger.log(err.message);
            console.log(err.message);
            await timeout(pauseTime);
        }

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
    }
}

const bridgeBTCToOptimism = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const balanceBTCB = await getAmountToken(info.rpcArbitrum, info.BTCb, address);

    try {
        await feeBridgeBTC(info.rpcArbitrum, 111, balanceBTCB, info.BTCb, 2, 400000, 0, address).then(async(bridgeFee) => {
            await lzAdapterParamsToBytes(2, 400000, 0, address).then(async(adapterParams) => {
                await dataBridgeBTC(info.rpcArbitrum, balanceBTCB, 111, adapterParams, bridgeFee, info.BTCb, address).then(async(res) => {
                    await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                        gasPrice = (parseFloat(gasPrice * 1.5).toFixed(5)).toString();
                        await sendArbitrumTX(info.rpcArbitrum, res.estimateGas, gasPrice, gasPrice, info.BTCb, bridgeFee, res.encodeABI, privateKey);
                    });
                });
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        await timeout(pauseTime);
    }
}

const bridgeBTCToArbitrum = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const balanceBTCB = await getAmountToken(info.rpcOptimism, info.BTCb, address);

    try {
        await feeBridgeBTC(info.rpcOptimism, 110, balanceBTCB, info.BTCb, 2, 3000000, 0, address).then(async(bridgeFee) => {
            await lzAdapterParamsToBytes(2, 3000000, 0, address).then(async(adapterParams) => {
                await dataBridgeBTC(info.rpcOptimism, balanceBTCB, 110, adapterParams, bridgeFee, info.BTCb, address).then(async(res) => {
                    await getGasPrice(info.rpcOptimism).then(async(gasPrice) => {
                        gasPrice = (parseFloat(gasPrice * 1.5).toFixed(5)).toString();
                        await sendOptimismTX(info.rpcOptimism, res.estimateGas, gasPrice, info.BTCb, bridgeFee, res.encodeABI, privateKey);
                    });
                });
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        await timeout(pauseTime);
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
        await timeout(pauseTime);
    }
}

const bridgeETHToArbitrum = async(privateKey) => {
    const address = privateToAddress(privateKey);
    const amountETH = parseInt(
        multiply(await getETHAmount(info.rpcOptimism, address),
            generateRandomAmount(process.env.PERCENT_BRIDGE_MIN / 100, process.env.PERCENT_BRIDGE_MIN / 100, 3))
    );

    try{
        await feeBridgeStargate(info.rpcOptimism, 110, info.StargateRouterOptimism, 0, 0, address).then(async(bridgeFee) => {
            const value = add(amountETH, bridgeFee);
            await dataBridgeETH(info.rpcOptimism, 110, amountETH, value, info.ETHRouterOptimism, address).then(async(res) => {
                await getGasPrice(info.rpcOptimism).then(async(gasPrice) => {
                    gasPrice = (parseFloat(gasPrice * 1.5).toFixed(5)).toString();
                    await sendOptimismTX(info.rpcOptimism, res.estimateGas, gasPrice, info.ETHRouterOptimism, value, res.encodeABI, privateKey);
                });
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        await timeout(pauseTime);
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
        await timeout(pauseTime);
    }
}

const withdrawETHToSubWalletArbitrum = async(toAddress, privateKey) => {
    const addressETH = privateToAddress(privateKey);

    try {
        await getETHAmount(info.rpcArbitrum, addressETH).then(async(amountETH) => {
            await getGasPrice(info.rpcArbitrum).then(async(gasPrice) => {
                gasPrice = (parseFloat(multiply(gasPrice, 1.2)).toFixed(5)).toString();
                amountETH = subtract(amountETH, 1100000 * multiply(gasPrice, 10**9));
                await sendArbitrumTX(info.rpcArbitrum, generateRandomAmount(900000, 1000000, 0), gasPrice, gasPrice, toAddress, amountETH, null, privateKey);
                console.log(chalk.yellow(`Send ${amountETH / 10**18}ETH to ${toAddress} Arbitrum`));
                logger.log(`Send ${amountETH / 10**18}ETH to ${toAddress} Arbitrum`);
            });
        });
    } catch (err) {
        logger.log(err.message);
        console.log(err.message);
        await timeout(pauseTime);
    }
}

(async() => {
    const wallet = parseFile('private.txt');
    const allStage = [
        'Send All FEE to Optimism',
        'Bridge BTC Arbitrum -> Optimism -> Arbitrum',
        'Bridge ETH Arbitrum -> Optimism -> Arbitrum',
        'Swap All BTCb -> ETH Arbitrum',
        'Bridge BTC from Arbitrum to Optimism',
        'Bridge BTC from Optimism to Arbitrum',
        'Bridge ETH from Arbitrum to Optimism',
        'Bridge ETH from Optimism to Arbitrum',
        'Random Bridge BTC/ETH Arbitrum -> Optimism -> Arbitrum',
        'Bridge ALL ETH from Optimism to Arbitrum',
        'Send to SubWallet Arbitrum',
    ];

    const index = readline.keyInSelect(allStage, 'Choose stage!');
    if (index == -1) { process.exit() };
    console.log(chalk.green(`Start ${allStage[index]}`));
    logger.log(`Start ${allStage[index]}`);
    
    for (let i = 0; i < wallet.length; i++) {
        try {
            console.log(chalk.blue(`Wallet ${i+1}: ${privateToAddress(wallet[i])}`));
            logger.log(`Wallet ${i+1}: ${privateToAddress(wallet[i])}`);
        } catch (err) { throw new Error('Error: Add Private Keys!') };

        if (index == 0) {
            await sendFeeToOptimism(wallet[i]);
        } else if (index == 1) {
            await circeBTCBridge(wallet[i]);
        } else if (index == 2) {
            await circeETHBridge(wallet[i]);
        } else if (index == 3) {
            await swapBTCBToETH(wallet[i]);
        }  else if (index == 4) {
            await bridgeBTCToOptimism(wallet[i]);
        } else if (index == 5) {
            await bridgeBTCToArbitrum(wallet[i]);
        } else if (index == 6) {
            await bridgeETHToOptimism(wallet[i]);
        } else if (index == 7) {
            await bridgeETHToArbitrum(wallet[i]);
        } else if (index == 8) {
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
        } else if (index == 9) {
            await bridgeAllETHToArbitrum(wallet[i]);
        } else if (index == 10) {
            const walletOKX = parseFile('subWallet.txt');
            await withdrawETHToSubWalletArbitrum(walletOKX[i], wallet[i]);
        }

        await timeout(pauseWalletTime);
    }
    console.log(chalk.bgMagentaBright('Process End!'));
    logger.log('Process End!');
})();