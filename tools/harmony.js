import Web3 from 'web3';
import { ethers } from 'ethers';
import { info } from './other.js';
import { harmonyAbi } from './abi.js';

export const lzAdapterParamsHarmony = async(version, gasAmount) => {
    const w3 = new Web3();
    const adapterParamsBytes = ethers.utils.solidityPack(
        ['uint16','uint256'],
        [version, w3.utils.numberToHex(gasAmount)]
    );

    return adapterParamsBytes;
}

export const feeBridgeHarmony = async(rpc, toChainId, amountToken, routerAddress, versionLZ, gasAmountLZ, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const bridge = new w3.eth.Contract(harmonyAbi, w3.utils.toChecksumAddress(routerAddress));

    const data = await bridge.methods.estimateSendFee(
        toChainId,
        fromAddress,
        w3.utils.numberToHex(amountToken),
        false,
        await lzAdapterParamsHarmony(versionLZ, gasAmountLZ)
    ).call();

    return data.nativeFee;
}

export const dataBridgeHarmony = async(rpc, amountToken, toChainId, adapterParams, valueTx, addressRouter, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    
    const bridge = new w3.eth.Contract(harmonyAbi, w3.utils.toChecksumAddress(addressRouter));

    const data = await bridge.methods.sendFrom(
        fromAddress,
        toChainId,
        fromAddress,
        w3.utils.numberToHex(amountToken),
        fromAddress,
        '0x0000000000000000000000000000000000000000',
        adapterParams
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: fromAddress, value: valueTx });
    return { encodeABI, estimateGas };
}