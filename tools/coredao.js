import Web3 from 'web3';
import { info } from './other.js';
import { coreAbi } from './abi.js';

export const feeBridgeCore = async(rpc, isCore, chainId, adapterParams, routerAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const bridge = new w3.eth.Contract(coreAbi, w3.utils.toChecksumAddress(routerAddress));

    let data;
    if (isCore == false) {
        data = await bridge.methods.estimateBridgeFee(
            false,
            adapterParams,
        ).call();
    } else if (isCore == true) {
        data = await bridge.methods.estimateBridgeFee(
            chainId,
            false,
            adapterParams,
        ).call();
    }
    

    return data.nativeFee;
}

export const dataBridgeCore = async(rpc, isCore, chainId,  addressToken, amount, adapterParams, valueTx, addressRouter, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const bridge = new w3.eth.Contract(coreAbi, w3.utils.toChecksumAddress(addressRouter));

    let data;
    if (isCore == false) {
        data = await bridge.methods.bridge(
            addressToken,
            w3.utils.numberToHex(amount),
            fromAddress,
            [fromAddress, '0x0000000000000000000000000000000000000000'],
            adapterParams
        );
    } else if (isCore == true) {
        data = await bridge.methods.bridge(
            addressToken,
            chainId,
            w3.utils.numberToHex(amount),
            fromAddress,
            false,
            [fromAddress, '0x0000000000000000000000000000000000000000'],
            adapterParams
        );
    }
    
    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: fromAddress, value: valueTx });
    return { encodeABI, estimateGas };
}