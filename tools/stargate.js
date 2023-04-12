import Web3 from 'web3';
import { ethers } from 'ethers';
import { subtract, multiply, divide } from 'mathjs';
import { info } from './other.js';
import { abiToken } from './abi.js';
import * as dotenv from 'dotenv';
dotenv.config()

export const lzAdapterParamsToBytes = async(version, gasAmount, nativeForDst, addressOnDst) => {
    const w3 = new Web3();
    const adapterParamsBytes = ethers.utils.solidityPack(
        ['uint16','uint256','uint256','address'],
        [version, gasAmount, w3.utils.numberToHex(nativeForDst), addressOnDst]
    );

    return adapterParamsBytes;
}