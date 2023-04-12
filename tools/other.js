import Web3 from 'web3';
import fs from 'fs';

export const info = {
    rpcGoerli: 'https://rpc.ankr.com/eth_goerli',
    rpcETH: 'https://eth.llamarpc.com',
    rpcArbitrum: 'https://arbitrum-one.public.blastapi.io',
    rpcOptimism: 'https://endpoints.omniatech.io/v1/op/mainnet/public',
    explorerTest: 'https://goerli.explorer.zksync.io/tx/',
    explorerETH: 'https://etherscan.io/tx/',
    explorerArbitrum: 'https://arbiscan.io/tx/',
    explorerOptimism: 'https://optimistic.etherscan.io/tx/',
    traderJoeArbitrumRouter: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
    WETHArbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    BTCBArbitrum: '0x2297aEbD383787A160DD0d9F71508148769342E3',
    WETHBTCBLPArbitrum: '0xdF34e7548AF638cC37b8923ef1139EA98644735a',
    approveAmount: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
}

export const timeout = ms => new Promise(res => setTimeout(res, ms));

export const shuffle = (array) => {
    let currentIndex = array.length,  randomIndex;
    // While there remain elements to shuffle.
    while (currentIndex != 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }

    return array;
}

export const generateRandomAmount = (min, max, num) => {
    const amount = Number(Math.random() * (parseFloat(max) - parseFloat(min)) + parseFloat(min));
    return Number(parseFloat(amount).toFixed(num));
}

export const parseFile = (file) => {
    const data = fs.readFileSync(file, "utf-8");
    const array = (data.replace(/[^a-zA-Z0-9\n]/g,'')).split('\n');
    return array;
}

export const privateToAddress = (privateKey) => {
    const w3 = new Web3();
    return w3.eth.accounts.privateKeyToAccount(privateKey).address;
}