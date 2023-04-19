import Web3 from 'web3';
import fs from 'fs';

export const info = {
    rpcETH: 'https://eth.llamarpc.com',
    rpcArbitrum: 'https://arbitrum-one.public.blastapi.io',
    rpcOptimism: 'https://endpoints.omniatech.io/v1/op/mainnet/public',
    rpcPolygon: 'https://polygon.llamarpc.com',
    rpcBSC: 'https://1rpc.io/bnb',
    rpcAvalanche: 'https://rpc.ankr.com/avalanche',
    chainIdArbitrum: '110',
    chainIdOptimism: '111',
    chainIdPolygon: '109',
    chainIdBSC: '102',
    chainIdAvalanche: '106',
    explorerETH: 'https://etherscan.io/tx/',
    explorerArbitrum: 'https://arbiscan.io/tx/',
    explorerOptimism: 'https://optimistic.etherscan.io/tx/',
    explorerPolygon: 'https://polygonscan.com/tx/',
    explorerBSC: 'https://bscscan.com/tx/',
    explorerAvalanche: 'https://snowtrace.io/tx/',
    traderJoeArbitrumRouter: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
    WETHArbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    BTCb: '0x2297aEbD383787A160DD0d9F71508148769342E3',
    BTCbAvalanche: '0x152b9d0FdC40C096757F570A51E494bd4b943E50',
    WETHBTCBLPArbitrum: '0xdF34e7548AF638cC37b8923ef1139EA98644735a',
    StargateRouterArbitrum: '0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614',
    StargateRouterOptimism: '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b',
    ETHRouterArbitrum: '0xbf22f0f184bCcbeA268dF387a49fF5238dD23E40',
    ETHRouterOptimism: '0xB49c4e680174E331CB0A7fF3Ab58afC9738d5F8b',
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