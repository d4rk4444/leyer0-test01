export const abiToken = [
    {
        "type":"function",
        "name":"balanceOf",
        "inputs": [{"name":"account","type":"address"}],
        "outputs": [{"name":"amount","type":"uint256"}]
    },
    {
        "type":"function",
        "name":"allowance",
        "inputs": [
            {"name":"owner","type":"address"},
            {"name":"spender","type":"address"}
        ],
        "outputs": [{"name":"amount","type":"uint256"}]
    },
    {
        "type":"function",
        "name":"decimals",
        "inputs": [],
        "outputs": [{"name":"","type":"uint8"}]
    },
    {
        "type":"function",
        "name":"transfer",
        "inputs": [
            {"name":"recipient","type":"address"},
            {"name":"amount","type":"uint256"}
        ]
    },
    {
        "type":"function",
        "name":"transferFrom",
        "inputs": [
            {"name":"sender","type":"address"},
            {"name":"recipient","type":"address"},
            {"name":"amount","type":"uint256"}
        ]
    },
    {
        "type":"function",
        "name":"approve",
        "inputs": [
            {"name":"spender","type":"address"},
            {"name":"amount","type":"uint256"}
        ]
    }
  ]

export const traderJoeAbi = [
    {
        "type":"function",
        "name":"getSwapIn",
        "inputs": [
            {"name":"pair","type":"address"},
            {"name":"amountOut","type":"uint128"},
            {"name":"swapForY","type":"bool"},
        ],
        "outputs": [
            {"name":"amountIn","type":"uint128"},
            {"name":"amountOutLeft","type":"uint128"},
            {"name":"fee","type":"uint128"},
        ]
    },
    {
        "type":"function",
        "name":"getSwapOut",
        "inputs": [
            {"name":"pair","type":"address"},
            {"name":"amountIn","type":"uint128"},
            {"name":"swapForY","type":"bool"},
        ],
        "outputs": [
            {"name":"amountInLeft","type":"uint128"},
            {"name":"amountOut","type":"uint128"},
            {"name":"fee","type":"uint128"},
        ]
    },
    {
        "type":"function",
        "name":"swapExactNATIVEForTokens",
        "inputs": [
            {"name":"amountOutMin","type":"uint256"},
            {
                "name":"path",
                "type":"tuple",
                "components": [{
                    "name": "pairBinSteps",
                    "type": "uint256[]"
                },
                {
                    "name": "versions",
                    "type": "uint8[]"
                },
                {
                    "name": "tokenPath",
                    "type": "address[]"
                }]
            },
            {"name":"to","type":"address"},
            {"name":"deadline","type":"uint256"}
        ]
    },
    {
        "type":"function",
        "name":"swapExactTokensForNATIVE",
        "inputs": [
            {"name":"amountIn","type":"uint256"},
            {"name":"amountOutMinNATIVE","type":"uint256"},
            {
                "name":"path",
                "type":"tuple",
                "components": [{
                    "name": "pairBinSteps",
                    "type": "uint256[]"
                },
                {
                    "name": "versions",
                    "type": "uint8[]"
                },
                {
                    "name": "tokenPath",
                    "type": "address[]"
                }]
            },
            {"name":"to","type":"address"},
            {"name":"deadline","type":"uint256"}
        ]
    },
]