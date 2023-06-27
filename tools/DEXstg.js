import Web3 from 'web3';
import { ethers } from 'ethers';
import { info } from './other.js';
import { traderJoeAbi, uniswapAbi, abiToken } from './abi.js';
import { subtract, multiply, divide, add } from 'mathjs';

export const getLBPair = async(rpc, tokenA, tokenB, getRest) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, info.factoryTraderJoe);

    const data = await contract.methods.getAllLBPairs(
        tokenA,
        tokenB,
    ).call();

    for(let i = 0; i < data.length; i++) {
        if (data[i].createdByOwner) {
            return data[i];
        } else if (getRest) {
            return data[0];
        }
    }

    return false;
}

const getTokenY = async(rpc, addressLB) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, addressLB);

    const data = await contract.methods.getTokenY().call();

    return w3.utils.toChecksumAddress(data);
}

export const getAmountOut = async(rpc, amountIn, addressLB, swapForY, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, info.routerTraderJoe);

    const data = await contract.methods.getSwapOut(
        addressLB,
        w3.utils.numberToHex(amountIn),
        swapForY 
    ).call();

    const amountOut = parseInt(multiply(data.amountOut, slippage));
    const fee = data.fee;

    return { amountOut, fee };
}

export const getAmountIn = async(rpc, amountOut, addressLB, swapForY, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, info.routerTraderJoe);

    const data = await contract.methods.getSwapIn(
        addressLB,
        w3.utils.numberToHex(amountOut),
        swapForY
    ).call();

    const amountIn = parseInt(multiply(data.amountIn, slippage));
    const fee = data.fee;

    return { amountIn, fee };
}

export const dataTraderJoeSwapETHToToken = async(rpc, tokenA, tokenMid, tokenB, amountIn, sender, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, info.routerTraderJoe);

    let infoLB = await getLBPair(rpc, tokenA, tokenB);
    let swapForY;
    let amountOutMin;
    let path;
    if (!infoLB && tokenMid) {
        infoLB = await getLBPair(rpc, tokenA, tokenMid);
        const infoLB1 = await getLBPair(rpc, tokenMid, tokenB, true);
        await getTokenY(rpc, infoLB.LBPair).then(async(tokenY) => {
            swapForY = tokenY == tokenMid ? true : false;
            await getAmountOut(rpc, amountIn, infoLB.LBPair, swapForY, slippage).then(async(res) => {
                await getTokenY(rpc, infoLB1.LBPair).then(async(tokenY) => {
                    swapForY = tokenY == tokenB ? true : false;
                    await getAmountOut(rpc, w3.utils.numberToHex(res.amountOut), infoLB1.LBPair, swapForY, slippage).then((res1) => {
                        amountOutMin = res1.amountOut;
                    });
                });
            });
        });
        path = [
            [infoLB.binStep, infoLB1.binStep],
            [2, 2],
            [tokenA, tokenMid, tokenB]
        ];
    } else if (!infoLB && !tokenMid) {
        //let infoLP = await getPairV1(rpc, tokenA, tokenB);
        amountOutMin = amountIn * 15;
        path = [
            [0],
            [0],
            [tokenA, tokenB]
        ];
    } else {
        swapForY = await getTokenY(rpc, infoLB.LBPair) == tokenB ? true : false;
        amountOutMin = (await getAmountOut(rpc, w3.utils.numberToHex(amountIn), infoLB.LBPair, swapForY, slippage)).amountOut;
        path = [
            [infoLB.binStep],
            [2],
            [tokenA, tokenB]
        ];
    }

    const data = await contract.methods.swapExactNATIVEForTokens(
        w3.utils.numberToHex(amountOutMin),
        path,
        sender,
        Date.now() + 60 * 60 * 1000
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: sender, value: amountIn });
    return { encodeABI, estimateGas };
}

export const dataTraderJoeSwapTokenToETH = async(rpc, tokenA, tokenMid, tokenB, amountIn, sender, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, info.routerTraderJoe);

    let infoLB = await getLBPair(rpc, tokenA, tokenB);
    let swapForY;
    let amountOutMin;
    let path;
    if (!infoLB) {
        infoLB = await getLBPair(rpc, tokenA, tokenMid);
        const infoLB1 = await getLBPair(rpc, tokenMid, tokenB);
        await getTokenY(rpc, infoLB.LBPair).then(async(tokenY) => {
            swapForY = tokenY == tokenMid ? true : false;
            await getAmountOut(rpc, amountIn, infoLB.LBPair, swapForY, slippage).then(async(res) => {
                await getTokenY(rpc, infoLB1.LBPair).then(async(tokenY) => {
                    swapForY = tokenY == tokenB ? true : false;
                    await getAmountOut(rpc, w3.utils.numberToHex(res.amountOut), infoLB1.LBPair, swapForY, slippage).then((res1) => {
                        amountOutMin = res1.amountOut;
                    });
                });
            });
        });
        path = [
            [infoLB.binStep, infoLB1.binStep],
            [2, 2],
            [tokenA, tokenMid, tokenB]
        ];
    } else {
        swapForY = await getTokenY(rpc, infoLB.LBPair) == tokenB ? true : false;
        amountOutMin = (await getAmountOut(rpc, w3.utils.numberToHex(amountIn), infoLB.LBPair, swapForY, slippage)).amountOut;
        path = [
            [infoLB.binStep],
            [2],
            [tokenA, tokenB]
        ];
    }
    const data = await contract.methods.swapExactTokensForNATIVE(
        w3.utils.numberToHex(amountIn),
        w3.utils.numberToHex(amountOutMin),
        path,
        sender,
        Date.now() + 5 * 60 * 1000
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: sender });
    return { encodeABI, estimateGas };
}

export const getAmountOutUniV3 = async(rpc, tokenA, tokenB, amountIn, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(uniswapAbi, info.quoterUniswap);

    const data = await contract.methods.quoteExactInputSingle(
        [
            tokenA,
            tokenB,
            w3.utils.numberToHex(amountIn),
            '3000',
            0
        ]
    ).call();
    const amountOut = parseInt(multiply(data.amountOut, slippage));

    return amountOut;
}

export const getAmountInUniV3 = async(rpc, tokenA, tokenB, amountOut, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(uniswapAbi, info.quoterUniswap);

    const data = await contract.methods.quoteExactOutputSingle(
        [
            tokenA,
            tokenB,
            w3.utils.numberToHex(amountOut),
            '3000',
            0
        ]
    ).call();
    const amountIn = parseInt(multiply(data.amountIn, slippage));

    return amountIn;
}

export const dataUniSwapETHToToken = async(rpc, tokenA, tokenB, amountIn, sender, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(uniswapAbi, info.uniswapRouter);

    const wrapETH = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256'],
        ['0x0000000000000000000000000000000000000002', w3.utils.numberToHex(amountIn)]
    );

    const path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address'],
        [tokenA, '10000', tokenB]
    );

    const swapETH = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint256', 'bytes', 'bool'],
        ['0x0000000000000000000000000000000000000001', w3.utils.numberToHex(amountIn), w3.utils.numberToHex(await getAmountOutUniV3(rpc, tokenA, tokenB, w3.utils.numberToHex(amountIn), slippage)), path, false]
    );

    const data = await contract.methods.execute(
        '0x0b00',
        [
            wrapETH,
            swapETH
        ],
        Date.now() + 60 * 60 * 1000
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: sender, value: amountIn });
    return { encodeABI, estimateGas };
}