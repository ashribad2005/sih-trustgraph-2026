/**
 * scripts/deploy_audit.js
 * ========================
 * TrustGraph 2026 — Hardhat Deployment Script for TrustGraphAudit.sol
 *
 * Usage:
 *   npx hardhat run scripts/deploy_audit.js --network polygonAmoy
 *   npx hardhat run scripts/deploy_audit.js --network sepolia
 *
 * After deployment, copy the printed CONTRACT_ADDRESS into your .env file.
 *
 * hardhat.config.js required networks:
 *   polygonAmoy: { url: process.env.RPC_URL, chainId: 80002, accounts: [process.env.WALLET_PRIVATE_KEY] }
 *   sepolia:     { url: process.env.RPC_URL, chainId: 11155111, accounts: [process.env.WALLET_PRIVATE_KEY] }
 */

const { ethers, network } = require("hardhat");

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  TrustGraph 2026 — TrustGraphAudit Deployment");
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`\nNetwork        : ${network.name} (Chain ID: ${network.config.chainId ?? "unknown"})`);
  console.log(`Deployer       : ${deployer.address}`);
  console.log(`Balance        : ${ethers.formatEther(balance)} ETH/MATIC\n`);

  if (balance === 0n) {
    throw new Error(
      "Deployer wallet has zero balance. Fund it at https://faucet.polygon.technology"
    );
  }

  console.log("Deploying TrustGraphAudit …");
  const TrustGraphAudit = await ethers.getContractFactory("TrustGraphAudit");
  const contract = await TrustGraphAudit.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log("\n✅  Deployment successful!");
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`TX Hash         : ${deployTx?.hash ?? "N/A"}`);

  // Print explorer link based on network
  const explorerLinks = {
    polygonAmoy: `https://amoy.polygonscan.com/address/${contractAddress}`,
    sepolia:     `https://sepolia.etherscan.io/address/${contractAddress}`,
  };
  const explorerUrl = explorerLinks[network.name] ?? `(check your network explorer)`;
  console.log(`Explorer        : ${explorerUrl}`);

  console.log("\n─".repeat(60));
  console.log("Next steps:");
  console.log(`  1. Add to .env: CONTRACT_ADDRESS=${contractAddress}`);
  console.log("  2. Run: python backend/demo_tamper_showcase.py --live");
  console.log("─".repeat(60) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
