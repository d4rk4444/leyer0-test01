import Web3 from 'web3';
import { ethers } from 'ethers';
import { subtract, multiply, divide } from 'mathjs';
import { info } from './other.js';
import { abiToken, bridgeBTCAbi } from './abi.js';
import * as dotenv from 'dotenv';
dotenv.config()

export const lzAdapterParamsToBytes = async(version, gasAmount, nativeForDst, addressOnDst) => {
    const w3 = new Web3();
    const adapterParamsBytes = ethers.utils.solidityPack(
        ['uint16','uint256','uint256','address'],
        [version, w3.utils.numberToHex(gasAmount), w3.utils.numberToHex(nativeForDst), addressOnDst]
    );

    return adapterParamsBytes;
}

export const feeBridgeBTC = async(rpc, toChainId, amountToken, routerAddress, versionLZ, gasAmountLZ, nativeForDstLZ, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    
    const bridge = new w3.eth.Contract(bridgeBTCAbi, w3.utils.toChecksumAddress(routerAddress));
    const wallet32bytes = ethers.utils.hexZeroPad(fromAddress, 32);

    const data = await bridge.methods.estimateSendAndCallFee(
        toChainId,
        wallet32bytes,
        w3.utils.numberToHex(amountToken),
        '0x',
        w3.utils.numberToHex(gasAmountLZ),
        false,
        await lzAdapterParamsToBytes(versionLZ, gasAmountLZ, w3.utils.numberToHex(nativeForDstLZ), fromAddress)
    ).call();

    return data.nativeFee;
}

export const dataBridgeBTC = async(rpc, amount, toChainId, adapterParams, valueTx, addressRouter, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    
    const bridge = new w3.eth.Contract(bridgeBTCAbi, w3.utils.toChecksumAddress(addressRouter));
    const wallet32bytes = ethers.utils.hexZeroPad(fromAddress, 32);

    const data = await bridge.methods.sendFrom(
        fromAddress,
        toChainId,
        wallet32bytes,
        w3.utils.numberToHex(amount),
        w3.utils.numberToHex(amount),
        [fromAddress, '0x0000000000000000000000000000000000000000', adapterParams]
    );
    
    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: fromAddress, value: valueTx });
    return { encodeABI, estimateGas };
}