import Web3 from 'web3';
import fs from 'fs';
import { AptosClient, AptosAccount, CoinClient } from 'aptos';

export const info = {
    rpcETH: 'https://eth.llamarpc.com',
    rpcArbitrum: 'https://arbitrum-one.public.blastapi.io',
    rpcOptimism: 'https://endpoints.omniatech.io/v1/op/mainnet/public',
    rpcPolygon: 'https://polygon.llamarpc.com',
    rpcBSC: 'https://rpc.ankr.com/bsc',
    rpcAvalanche: 'https://rpc.ankr.com/avalanche',
    rpcCore: 'https://rpc.coredao.org',
    rpcHarmony: 'https://rpc.ankr.com/harmony',
    rpcAptos: 'https://aptos-mainnet-rpc.allthatnode.com/v1',
    rpcFantom: 'https://rpc.ankr.com/fantom',
    bscUSDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    bscUSDT: '0x55d398326f99059fF775485246999027B3197955',
    bridgeCoreBSC: '0x52e75D318cFB31f9A2EdFa2DFee26B161255B233',
    coreUSDC: '0xa4151B2B3e269645181dCcF2D426cE75fcbDeca9',
    coreUSDT: '0x900101d06A7426441Ae63e9AB3B9b0F63Be145F1',
    bridgeCoreCORE: '0xA4218e1F39DA4AaDaC971066458Db56e901bcbdE',
    bridgeHarmonyUSDCBSC: '0x8d1eBcDa83fd905b597bF6d3294766B64ecF2AA7',
    bridgeHarmonyUSDTBSC: '0x0551Ca9E33bada0355Dfce34685Ad3B73CF3Ad70',
    oneBSCUSDC: '0x44cED87b9F1492Bf2DCf5c16004832569f7f6cBa',
    oneBSCUSDT: '0x9A89d0e1b051640C6704Dde4dF881f73ADFEf39a',
    oneARBUSDC: '0x9b5fae311A4A4b9d838f301C9c27b55d19BAa4Fb',
    oneARBUSDT: '0x2DA729BA5231d2C79290aBA4a8b85a5c94dA4724',
    bridgeHarmonyBSCUSDCONE: '0xcE59e51645De8F8FF24229F89e105CadEb96EA57',
    bridgeHarmonyBSCUSDTONE: '0x8bab2DDe26CE3f948b9B3E146760B66b60810fc7',
    bridgeHarmonyARBUSDCONE: '0x11c4e687b865c1e8e17437748ab3d1faed7444ff',
    bridgeHarmonyARBUSDTONE: '0xe7cf1a353cdd4fb8cc8df4e80b2f7d27552ca711',
    arbUSDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    arbUSDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    bridgeHarmonyUSDCARB: '0x1c3979C2bb4f0e6dcb75Daf22ad0741Cf7D5F160',
    bridgeHarmonyUSDTARB: '0x297f0b9a452d34c9b1c15b36b173a9a0b0f0e10b',
    bridgeAptosBSC: '0x2762409baa1804d94d8c0bcff8400b78bf915d5b',
    bridgeAptosARB: '0x1bacc2205312534375c8d1801c27d28370656cff',
    wBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    wETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    chainIdArbitrum: '110',
    chainIdOptimism: '111',
    chainIdPolygon: '109',
    chainIdBSC: '102',
    chainIdAvalanche: '106',
    chainIdHarmony: '116',
    explorerETH: 'https://etherscan.io/tx/',
    explorerArbitrum: 'https://arbiscan.io/tx/',
    explorerOptimism: 'https://optimistic.etherscan.io/tx/',
    explorerPolygon: 'https://polygonscan.com/tx/',
    explorerBSC: 'https://bscscan.com/tx/',
    explorerAvalanche: 'https://snowtrace.io/tx/',
    explorerCore: 'https://scan.coredao.org/tx/',
    explorerHarmony: 'https://explorer.harmony.one/tx/',
    explorerAptos: 'https://explorer.aptoslabs.com/txn/',
    explorerFantom: 'https://ftmscan.com/tx/',
    routerTraderJoe: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
    factoryTraderJoe: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e',
    WETHArbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    BTCb: '0x2297aEbD383787A160DD0d9F71508148769342E3',
    BTCbAvalanche: '0x152b9d0FdC40C096757F570A51E494bd4b943E50',
    WETHBTCBLPArbitrum: '0xdF34e7548AF638cC37b8923ef1139EA98644735a',
    StargateRouterArbitrum: '0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614',
    StargateRouterOptimism: '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b',
    ETHRouterArbitrum: '0xbf22f0f184bCcbeA268dF387a49fF5238dD23E40',
    ETHRouterOptimism: '0xB49c4e680174E331CB0A7fF3Ab58afC9738d5F8b',
    GleamNFT: '0x4803e859a2e325dc8f6adcd23ea682e323f59640',
    factoryV1TraderJoe: '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10',
    wAVAX: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    wETHOP: '0x4200000000000000000000000000000000000006',
    STGArbitrum: '0x6694340fc020c5E6B96567843da2df01b2CE1eb6',
    STGBSC: '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b',
    USDTBSC: '0x55d398326f99059fF775485246999027B3197955',
    STGAvalanche: '0x2F6F07CDcf3588944Bf4C42aC74ff24bF56e7590',
    USDCAvalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    STGOptimism: '0x296F55F8Fb28E498B858d0BcDA06D955B2Cb3f97',
    veSTGArbitrum: '0xfBd849E6007f9BC3CC2D6Eb159c045B8dc660268',
    veSTGBSC: '0xd4888870c8686c748232719051b677791dbda26d',
    veSTGAvalanche: '0xCa0F57D295bbcE554DA2c07b005b7d6565a58fCE',
    veSTGOptimism: '0x43d2761ed16C89A2C4342e2B16A3C61Ccf88f05B',
    uniswapRouter: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    quoterUniswap: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    WFTM: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
    MIM: '0x82f0B8B456c1A451378467398982d4834b6829c1',
    spookyRouter: '0x31F63A33141fFee63D4B26755430a390ACdD8a4d',
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

export const numGenerate = () => {
    const w3 = new Web3();
    const string = w3.utils.randomHex(32);
    return w3.utils.hexToNumberString(string);
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

export const privateToAptosAddress = (privateKey) => {
    if (privateKey.startsWith('0x')) privateKey = privateKey.slice(2);
    const mainAccount = new AptosAccount(Uint8Array.from(Buffer.from(privateKey, 'hex')));
    return mainAccount.accountAddress.hexString;
}