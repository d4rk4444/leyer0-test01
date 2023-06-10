import Web3 from 'web3';
import { info, privateToAddress, privateToAptosAddress } from './other.js';
import { abiToken } from './abi.js';
import { AptosClient, AptosAccount, CoinClient } from 'aptos';

export const getGasPrice = async(rpcProvider) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpcProvider));
    const gasPrice = await w3.eth.getGasPrice();
    const gasPriceInGwei = w3.utils.fromWei(gasPrice, 'Gwei');

    return gasPriceInGwei;
}

export const getETHAmount = async(rpc, walletAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const data = await w3.eth.getBalance(walletAddress);
    return data;
}

export const getAmountToken = async(rpc, tokenAddress, walletAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const token = new w3.eth.Contract(abiToken, w3.utils.toChecksumAddress(tokenAddress));

    const data = await token.methods.balanceOf(
        walletAddress
    ).call();

    return data;
}

export const checkAllowance = async(rpc, tokenAddress, walletAddress, spender) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const token = new w3.eth.Contract(abiToken, w3.utils.toChecksumAddress(tokenAddress));

    const data = await token.methods.allowance(
        walletAddress,
        spender
    ).call();

    return data;
}

export const dataApprove = async(rpc, tokenAddress, contractAddress, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(abiToken, w3.utils.toChecksumAddress(tokenAddress));

    const data = await contract.methods.approve(
        contractAddress,
        info.approveAmount,
    );
    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: fromAddress });

    return { encodeABI, estimateGas };
}

export const dataSendToken = async (rpc, tokenAddress, toAddress, amount, fromAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new w3.eth.Contract(abiToken, w3.utils.toChecksumAddress(tokenAddress));

    const data = await contract.methods.transfer(
        toAddress,
        w3.utils.numberToHex(amount)
    );
    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: fromAddress });

    return { encodeABI, estimateGas };
}

export const sendEVMTX = async(rpc, typeTx, gasLimit, toAddress, value, data, privateKey, maxFeeOrGasPrice, maxPriorityFee) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const fromAddress = privateToAddress(privateKey);
    let tx;
    
    if (typeTx == 0) {
        tx = {
            'from': fromAddress,
            'gas': gasLimit,
            'gasPrice': w3.utils.toWei(maxFeeOrGasPrice, 'Gwei'),
            'chainId': await w3.eth.getChainId(),
            'to': toAddress,
            'nonce': await w3.eth.getTransactionCount(fromAddress),
            'value': value,
            'data': data
        }
    } else if (typeTx == 2) {
        tx = {
            'from': fromAddress,
            'gas': gasLimit,
            'maxFeePerGas': w3.utils.toWei(maxFeeOrGasPrice, 'Gwei'),
            'maxPriorityFeePerGas': w3.utils.toWei(maxPriorityFee, 'Gwei'),
            'chainId': await w3.eth.getChainId(),
            'to': toAddress,
            'nonce': await w3.eth.getTransactionCount(fromAddress),
            'value': value,
            'data': data
        }
    }

    const signedTx = await w3.eth.accounts.signTransaction(tx, privateKey);
    await w3.eth.sendSignedTransaction(signedTx.rawTransaction, async(error, hash) => {
        if (!error) {
            const chain = (Object.keys(info)[Object.values(info).findIndex(e => e == rpc)]).slice(3);
            const explorer = info['explorer' + (Object.keys(info)[Object.values(info).findIndex(e => e == rpc)]).slice(3)];
            console.log(`${chain} TX: ${explorer + hash}`);
        } else {
            console.log(`Error Tx: ${error}`);
        }
    });
}

export const getNonceAptos = async(rpc, privateKey) => {
    if (privateKey.startsWith('0x')) privateKey = privateKey.slice(2);
    const client = new AptosClient(rpc);
    const sender = new AptosAccount(Uint8Array.from(Buffer.from(privateKey, 'hex')));
    const nonce = (await client.getAccount(sender.address())).sequence_number;
    return nonce;
}

export const sendTransactionAptos = async(rpc, payload, nonce, gasLimit, privateKey) => {
    if (privateKey.startsWith('0x')) privateKey = privateKey.slice(2);
    const client = new AptosClient(rpc);
    const sender = new AptosAccount(Uint8Array.from(Buffer.from(privateKey, 'hex')));
    
    const txnRequest = await client.generateTransaction(sender.address(), payload, {
        gas_unit_price: 100,
        max_gas_amount: gasLimit,
        sequence_number: nonce
    });

    const signedTxn = await client.signTransaction(sender, txnRequest);
    const transactionRes = await client.submitTransaction(signedTxn);

    await client.waitForTransactionWithResult(transactionRes.hash, { checkSuccess: true }).then(async(hash) => {
        console.log(`Send TX in Aptos: ${info.explorerAptos + hash.hash}`);
    });
}

export const getAPTBalance = async(rpc, address) => {
    const client = new AptosClient(rpc);
    const coinClient = new CoinClient(client);
    const balance = Number(await coinClient.checkBalance(address));
    return balance;
}

export const getTokenBalanceAptos = async(rpc, address, ticker) => {
    const client = new AptosClient(rpc);
    const coinClient = new CoinClient(client);

    let balance = Number(await coinClient.checkBalance(address, {
        coinType: `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::${ticker}`
    }));

    return balance;
}