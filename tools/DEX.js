import Web3 from 'web3';
import { info } from './other.js';
import { traderJoeAbi, abiToken } from './abi.js';
import { subtract, multiply, divide, add } from 'mathjs';

export const getLBPair = async(rpc, tokenA, tokenB) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, info.factoryTraderJoe);

    const data = await contract.methods.getAllLBPairs(
        tokenA,
        tokenB,
    ).call();

    for(let i = 0; i < data.length; i++) {
        if (data[i].createdByOwner) {
            return data[i];
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