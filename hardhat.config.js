/**
 * hardhat.config.js
 * ==================
 * TrustGraph 2026 — Hardhat Configuration
 *
 * Supports:
 *   - Polygon Amoy Testnet (Chain ID: 80002)
 *   - Ethereum Sepolia     (Chain ID: 11155111)
 *   - Hardhat local node   (for unit tests)
 *
 * Install Hardhat:
 *   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
 *
 * Deploy to Amoy:
 *   npx hardhat run contracts/deploy_audit.js --network polygonAmoy
 *
 * Verify on PolygonScan:
 *   npx hardhat verify --network polygonAmoy <CONTRACT_ADDRESS>
 */

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const RPC_URL            = process.env.RPC_URL            || "";
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "";
const POLYGONSCAN_API    = process.env.POLYGONSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,           // Optimised for deployment cost
      },
      viaIR: false,
    },
  },

  networks: {
    // ── Local Hardhat node (default for tests) ──────────────────────────────
    hardhat: {
      chainId: 31337,
    },

    // ── Polygon Amoy Testnet ────────────────────────────────────────────────
    polygonAmoy: {
      url: RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: WALLET_PRIVATE_KEY ? [WALLET_PRIVATE_KEY] : [],
      gas: "auto",
      gasMultiplier: 1.3,
    },

    // ── Ethereum Sepolia Testnet ────────────────────────────────────────────
    sepolia: {
      url: RPC_URL || "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: WALLET_PRIVATE_KEY ? [WALLET_PRIVATE_KEY] : [],
      gas: "auto",
      gasMultiplier: 1.2,
    },
  },

  // ── Contract verification ──────────────────────────────────────────────────
  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API,
      sepolia:     process.env.ETHERSCAN_API_KEY || "",
    },
    customChains: [
      {
        network:  "polygonAmoy",
        chainId:  80002,
        urls: {
          apiURL:     "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },

  // ── Gas reporter ───────────────────────────────────────────────────────────
  gasReporter: {
    enabled:  process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
