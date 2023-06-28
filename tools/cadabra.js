import Web3 from 'web3';
import { ethers } from 'ethers';
import { info } from './other.js';
import { cadabraAbi } from './abi.js';

export const lzAdapterParamsToBytes = async(version, gasAmount, nativeForDst, addressOnDst) => {
    const w3 = new Web3();
    const adapterParamsBytes = ethers.utils.solidityPack(
        ['uint16','uint256','uint256','address'],
        [version, w3.utils.numberToHex(gasAmount), w3.utils.numberToHex(nativeForDst), addressOnDst]
    );

    return adapterParamsBytes;
}

export const feeBridgeCadabra = async(rpc, toChainId, amountToken, routerAddress, versionLZ, gasAmountLZ, nativeForDst, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const bridge = new w3.eth.Contract(cadabraAbi, w3.utils.toChecksumAddress(routerAddress));

    const data = await bridge.methods.estimateSendFee(
        toChainId,
        fromAddress,
        w3.utils.numberToHex(amountToken),
        false,
        await lzAdapterParamsToBytes(versionLZ, gasAmountLZ, nativeForDst, fromAddress)
    ).call();

    return data.nativeFee;
}

export const dataBridgeCadabara = async(rpc, amountToken, toChainId, adapterParams, valueTx, addressRouter, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    
    const bridge = new w3.eth.Contract(cadabraAbi, w3.utils.toChecksumAddress(addressRouter));
    const wallet32bytes = ethers.utils.hexZeroPad(fromAddress, 32);

    const data = await bridge.methods.sendFrom(
        fromAddress,
        toChainId,
        wallet32bytes,
        w3.utils.numberToHex(amountToken),
        [
            fromAddress,
            "0x0000000000000000000000000000000000000000",
            adapterParams
        ]
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: fromAddress, value: valueTx });
    return { encodeABI, estimateGas };
}