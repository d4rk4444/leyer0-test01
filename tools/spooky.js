import Web3 from 'web3';
import { ethers } from 'ethers';
import { info } from './other.js';
import { spookyAbi } from './abi.js';
import { subtract, multiply, divide, add } from 'mathjs';


export const getAmountOut = async(rpc, amountIn, tokenA, tokenB, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(spookyAbi, info.spookyRouter);

    const data = await contract.methods.getAmountsOut(
        w3.utils.numberToHex(amountIn),
        [tokenA, tokenB]
    ).call();

    const amountOut = parseInt(multiply(data[1], slippage));
    return amountOut;
}

export const dataSpookySwapFTMToToken = async(rpc, tokenA, tokenB, amountIn, sender, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(spookyAbi, info.spookyRouter);

    const swapETH = '0x7ff36ab5' + ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'address[]', 'address', 'uint256'],
        [w3.utils.numberToHex(await getAmountOut(rpc, amountIn, tokenA, tokenB, slippage)), [info.WFTM, info.MIM], sender, Date.now() + 60 * 60]
    ).slice(2);

    const data = await contract.methods.multicall(
        [swapETH]
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: sender, value: amountIn });
    return { encodeABI, estimateGas };
}

export const dataSpookySwapTokenToFTM = async(rpc, tokenA, tokenB, amountIn, sender, slippage) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(spookyAbi, info.spookyRouter);

    const swapETH = '0x18cbafe5' + ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256', 'address[]', 'address', 'uint256'],
        [w3.utils.numberToHex(amountIn), w3.utils.numberToHex(await getAmountOut(rpc, amountIn, tokenA, tokenB, slippage)), [info.MIM, info.WFTM], sender, Date.now() + 60 * 60]
    ).slice(2);

    const data = await contract.methods.multicall(
        [swapETH]
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: sender });
    return { encodeABI, estimateGas };
}