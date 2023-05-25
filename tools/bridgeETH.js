import Web3 from 'web3';
import { ethers } from 'ethers';
import { subtract, multiply, divide } from 'mathjs';
import { info } from './other.js';
import { abiToken, bridgeStargateAbi } from './abi.js';

export const feeBridgeStargate = async(rpc, toChainId, routerAddress, gasAmountLZ, nativeForDstLZ, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    
    const bridge = new w3.eth.Contract(bridgeStargateAbi, w3.utils.toChecksumAddress(routerAddress));

    const data = await bridge.methods.quoteLayerZeroFee(
        toChainId,
        1,
        fromAddress,
        '0x',
        [gasAmountLZ, w3.utils.numberToHex(nativeForDstLZ), fromAddress]
    ).call();
    const result = parseInt(data.nativeFee * 1.1);

    return result;
}

export const dataBridgeETH = async(rpc, toChainId, amountETH, valueTx, addressRouter, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const bridge = new w3.eth.Contract(bridgeStargateAbi, w3.utils.toChecksumAddress(addressRouter));

    const data = await bridge.methods.swapETH(
        toChainId,
        fromAddress,
        fromAddress,
        w3.utils.numberToHex(amountETH),
        w3.utils.numberToHex(parseInt(multiply(amountETH, 0.995))),
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: fromAddress, value: valueTx });
    return { encodeABI, estimateGas };
}