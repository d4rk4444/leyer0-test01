import Web3 from 'web3';
import { info } from './other.js';
import { traderJoeAbi, abiToken } from './abi.js';
import { subtract, multiply, divide, composition, add, BigNumber, pow } from 'mathjs';


export const getAmountOut = async(rpc, amountIn, addressLP, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, info.traderJoeArbitrumRouter);

    const data = await contract.methods.getSwapOut(
        addressLP,
        w3.utils.numberToHex(amountIn),
        false
    ).call();
    const amountOut = parseInt(multiply(data.amountOut, slippage));
    const fee = data.fee;

    return { amountOut, fee };
}

export const getAmountIn = async(rpc, amountOut, addressLP, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, info.traderJoeArbitrumRouter);

    const data = await contract.methods.getSwapIn(
        addressLP,
        w3.utils.numberToHex(amountOut),
        false
    ).call();
    const amountIn = parseInt(multiply(data.amountIn, slippage));
    const fee = data.fee;

    return { amountIn, fee };
}

export const dataTraderSwapETHToToken = async(rpc, tokenB, addressLP, amountIn, sender, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, info.traderJoeArbitrumRouter);

    const data = await contract.methods.swapExactNATIVEForTokens(
        w3.utils.numberToHex((await getAmountOut(rpc, amountIn, addressLP, slippage)).amountOut),
        [
            [10],
            [2],
            [info.WETHArbitrum, tokenB]
        ],
        sender,
        Date.now() + 5 * 60 * 1000
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: sender, value: amountIn });
    return { encodeABI, estimateGas };
}

export const dataTraderSwapTokenToETH = async(rpc, tokenB, addressLP, amountIn, sender, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(traderJoeAbi, info.traderJoeArbitrumRouter);

    const data = await contract.methods.swapExactTokensForNATIVE(
        w3.utils.numberToHex(amountIn),
        w3.utils.numberToHex((await getAmountIn(rpc, amountIn, addressLP, slippage)).amountIn),
        [
            [10],
            [2],
            [tokenB, info.WETHArbitrum]
        ],
        sender,
        Date.now() + 5 * 60 * 1000
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: sender });
    return { encodeABI, estimateGas };
}