export declare const dogeosTestnet: {
    blockExplorers: {
        readonly default: {
            readonly name: "Blockscout";
            readonly url: "https://blockscout.testnet.dogeos.com";
        };
    };
    blockTime?: number | undefined | undefined;
    contracts?: {
        [x: string]: import("viem").ChainContract | {
            [sourceId: number]: import("viem").ChainContract | undefined;
        } | undefined;
        ensRegistry?: import("viem").ChainContract | undefined;
        ensUniversalResolver?: import("viem").ChainContract | undefined;
        multicall3?: import("viem").ChainContract | undefined;
        erc6492Verifier?: import("viem").ChainContract | undefined;
    } | undefined;
    ensTlds?: readonly string[] | undefined;
    id: 6281971;
    name: "DogeOS Chikyū Testnet";
    nativeCurrency: {
        readonly decimals: 18;
        readonly name: "Dogecoin";
        readonly symbol: "DOGE";
    };
    experimental_preconfirmationTime?: number | undefined | undefined;
    rpcUrls: {
        readonly default: {
            readonly http: readonly ["https://rpc.testnet.dogeos.com"];
            readonly webSocket: readonly ["wss://ws.rpc.testnet.dogeos.com"];
        };
    };
    sourceId?: number | undefined | undefined;
    testnet: true;
    custom?: Record<string, unknown> | undefined;
    extendSchema?: Record<string, unknown> | undefined;
    fees?: import("viem").ChainFees<undefined> | undefined;
    formatters?: undefined;
    prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
        runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
    }] | undefined;
    serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
    verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
};
export declare const config: {
    rpcUrl: string;
    wsRpcUrl: string;
    chainId: number;
    contracts: {
        hasher: string;
        verifier: string;
        poolsV1: {
            usdc1: string;
            usdc10: string;
            usdc100: string;
            usdc1000: string;
        };
        poolsV2: {
            usdc1: string;
            usdc10: string;
            usdc100: string;
            usdc1000: string;
        };
        pools: {
            usdc1: string;
            usdc10: string;
            usdc100: string;
            usdc1000: string;
        };
    };
    tokens: {
        wdoge: string;
        usdc: string;
        usdt: string;
    };
    relayer: {
        privateKey: string;
        minFee: bigint;
        maxFee: bigint;
    };
    server: {
        port: number;
        host: string;
    };
    merkleTreeDepth: number;
};
export declare const MixerPoolABI: readonly [{
    readonly type: "event";
    readonly name: "Deposit";
    readonly inputs: readonly [{
        readonly name: "commitment";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "leafIndex";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "timestamp";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly name: "Withdrawal";
    readonly inputs: readonly [{
        readonly name: "recipient";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "nullifierHash";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "relayer";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "fee";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "function";
    readonly name: "deposit";
    readonly inputs: readonly [{
        readonly name: "commitment";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "withdraw";
    readonly inputs: readonly [{
        readonly name: "proof";
        readonly type: "uint256[8]";
    }, {
        readonly name: "root";
        readonly type: "bytes32";
    }, {
        readonly name: "nullifierHash";
        readonly type: "bytes32";
    }, {
        readonly name: "recipient";
        readonly type: "address";
    }, {
        readonly name: "relayer";
        readonly type: "address";
    }, {
        readonly name: "fee";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "isKnownRoot";
    readonly inputs: readonly [{
        readonly name: "root";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "isSpent";
    readonly inputs: readonly [{
        readonly name: "nullifierHash";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getLatestRoot";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getPoolInfo";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "_token";
        readonly type: "address";
    }, {
        readonly name: "_denomination";
        readonly type: "uint256";
    }, {
        readonly name: "_depositsCount";
        readonly type: "uint256";
    }, {
        readonly name: "_root";
        readonly type: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "nextLeafIndex";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}];
