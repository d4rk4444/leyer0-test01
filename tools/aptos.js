import Web3 from 'web3';
import { ethers } from 'ethers';
import { info } from './other.js';
import { aptosAbi } from './abi.js';
import { lzAdapterParamsToBytes } from './bridgeBTC.js';
import { sendTransactionAptos, getNonceAptos } from './web3.js';

export const feeBridgeAptos = async(rpc, routerAddress, versionLZ, gasAmountLZ, nativeForDstLZ, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const bridge = new w3.eth.Contract(aptosAbi, w3.utils.toChecksumAddress(routerAddress));

    const data = await bridge.methods.quoteForSend(
        [fromAddress, '0x0000000000000000000000000000000000000000'],
        await lzAdapterParamsToBytes(versionLZ, gasAmountLZ, w3.utils.toHex(nativeForDstLZ), fromAddress)
    ).call();

    return data.nativeFee;
}

export const dataBridgeTokenToAptos = async(rpc, routerAddress, addressToken, amount, aptAddress, adapterParams, valueTx, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const bridge = new w3.eth.Contract(aptosAbi, w3.utils.toChecksumAddress(routerAddress));

    const data = await bridge.methods.sendToAptos(
        addressToken,
        aptAddress,
        amount,
        [fromAddress, '0x0000000000000000000000000000000000000000'],
        adapterParams
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: fromAddress, value: valueTx });
    return { encodeABI, estimateGas };
}

export const claimTokenBridgeAptos = async(rpc, ticker, privateKey) => {
    return await sendTransactionAptos(rpc, {
        "function": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::coin_bridge::claim_coin",
        "type_arguments": [
          `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::${ticker}`
        ],
        "arguments": [],
        "type": "entry_function_payload"
    }, await getNonceAptos(rpc, privateKey), 2200, privateKey);
}

export const dataBridgeTokenFromAptos = async(rpc, ticker, dstChainId, amountToken, feeBridge, toAddress, privateKey) => {
    const w3 = new Web3();
    return await sendTransactionAptos(rpc, {
        "function": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::coin_bridge::send_coin_from",
        "type_arguments": [
          `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::${ticker}`
        ],
        "arguments": [
          dstChainId,
          Buffer.from(w3.utils.hexToBytes(ethers.utils.hexZeroPad(toAddress, 32))),
          amountToken,
          feeBridge, // 1 = 10**8
          "0",
          false,
          Buffer.from(w3.utils.hexToBytes('0x000100000000000249f0')),
          Buffer.from('0x', 'hex')
        ],
        "type": "entry_function_payload"
    }, await getNonceAptos(rpc, privateKey), 1000, privateKey);
}