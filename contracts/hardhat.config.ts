import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "prague",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    dogeosTestnet: {
      url: process.env.DOGEOS_RPC_URL || "https://rpc.testnet.dogeos.com",
      chainId: 6281971,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
    dogeosUnifra: {
      url: "https://dogeos-testnet-public.unifra.io/",
      chainId: 6281971,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: {
      dogeosTestnet: "no-api-key-needed",
    },
    customChains: [
      {
        network: "dogeosTestnet",
        chainId: 6281971,
        urls: {
          apiURL: "https://blockscout.testnet.dogeos.com/api",
          browserURL: "https://blockscout.testnet.dogeos.com",
        },
      },
    ],
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;

