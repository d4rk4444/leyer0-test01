import Web3 from 'web3';
import { info } from './other.js';
import * as dotenv from 'dotenv';
dotenv.config()

export const mintHoloNFT = async(rpc, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));

    const encodeABI = '0xefef39a10000000000000000000000000000000000000000000000000000000000000001';
    const estimateGas = await w3.eth.estimateGas({ data: encodeABI, from: fromAddress, to: info.GleamNFT });

    return { encodeABI, estimateGas };
}