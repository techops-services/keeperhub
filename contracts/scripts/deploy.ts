import { ethers, network } from "hardhat";

// Chainlink ETH/USD Price Feed addresses
const CHAINLINK_ETH_USD = {
  mainnet: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  sepolia: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
} as const;

// Stablecoin addresses
const STABLECOINS = {
  mainnet: {
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    usds: "0xdC035D45d973E3EC169d2276DDab16f1e407384F", // Sky Dollar
  },
  sepolia: {
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle's official Sepolia USDC
    usdt: "0x9F3BDc4459f0436eA0fe925d9aE6963eF1b7bb17", // Our mock USDT
    usds: "0x39d38839AAC04327577c795b4aC1E1235700EfCF", // Our mock USDS
  },
} as const;

async function main() {
  const networkName = network.name as "mainnet" | "sepolia";
  console.log(`\nDeploying to ${networkName}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  // Get addresses for this network
  const priceFeed = CHAINLINK_ETH_USD[networkName];
  const stables = STABLECOINS[networkName];

  console.log("Using addresses:");
  console.log("  ETH/USD Price Feed:", priceFeed);
  console.log("  USDC:", stables.usdc);
  console.log("  USDT:", stables.usdt);
  console.log("  USDS:", stables.usds);
  console.log("");

  // Deploy KeeperHubCredits
  console.log("Deploying KeeperHubCredits...");
  const Credits = await ethers.getContractFactory("KeeperHubCredits");
  const credits = await Credits.deploy(
    priceFeed,
    stables.usdc,
    stables.usdt,
    stables.usds,
    deployer.address // Initial admin
  );
  await credits.waitForDeployment();
  const creditsAddress = await credits.getAddress();
  console.log("KeeperHubCredits deployed to:", creditsAddress);

  // Deploy KeeperHubTiers
  console.log("\nDeploying KeeperHubTiers...");
  const Tiers = await ethers.getContractFactory("KeeperHubTiers");
  const tiers = await Tiers.deploy(
    priceFeed,
    stables.usdc,
    stables.usdt,
    stables.usds,
    deployer.address // Initial admin
  );
  await tiers.waitForDeployment();
  const tiersAddress = await tiers.getAddress();
  console.log("KeeperHubTiers deployed to:", tiersAddress);

  // Output summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(`Network: ${networkName}`);
  console.log(`KeeperHubCredits: ${creditsAddress}`);
  console.log(`KeeperHubTiers: ${tiersAddress}`);
  console.log("========================================\n");

  // Save addresses to file for reference
  const fs = await import("node:fs");
  const deployment = {
    network: networkName,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      KeeperHubCredits: creditsAddress,
      KeeperHubTiers: tiersAddress,
    },
    config: {
      priceFeed,
      stables,
    },
  };

  fs.writeFileSync(
    `./deployments/${networkName}.json`,
    JSON.stringify(deployment, null, 2)
  );
  console.log(`Deployment info saved to deployments/${networkName}.json`);

  // Wait for etherscan to index the contracts
  if (networkName !== "hardhat") {
    console.log("\nWaiting 30 seconds for Etherscan to index...");
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
