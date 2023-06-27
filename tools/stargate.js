import Web3 from 'web3';
import { info } from './other.js';
import { veSTGAbi } from './abi.js';

export const getStakeTimeAmount = async(rpc, veSTG, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    
    const bridge = new w3.eth.Contract(veSTGAbi, w3.utils.toChecksumAddress(veSTG));

    const data = await bridge.methods.locked(
        fromAddress
    ).call();
    const amount = data.amount;
    const date = data.end;

    return { amount, date };
}

export const dataStakeSTG = async(rpc, addressToken, amount, time, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(veSTGAbi, w3.utils.toChecksumAddress(addressToken));

    const data = await contract.methods.create_lock(
        amount,
        time
    );

    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: fromAddress });
    return { encodeABI, estimateGas };
}