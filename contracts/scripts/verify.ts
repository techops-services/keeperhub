import { existsSync, readFileSync } from "node:fs";
import { network, run } from "hardhat";

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
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle's Sepolia USDC
    usdt: "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06", // Mock USDT
    usds: "0x0000000000000000000000000000000000000000", // Deploy mock or skip
  },
} as const;

async function main() {
  const networkName = network.name as "mainnet" | "sepolia";

  // Read deployment file
  const deploymentPath = `./deployments/${networkName}.json`;
  if (!existsSync(deploymentPath)) {
    throw new Error(
      `No deployment found for ${networkName}. Run deploy first.`
    );
  }

  const deployment = JSON.parse(readFileSync(deploymentPath, "utf-8"));
  const priceFeed = CHAINLINK_ETH_USD[networkName];
  const stables = STABLECOINS[networkName];

  console.log(`\nVerifying contracts on ${networkName}...\n`);

  // Verify KeeperHubCredits
  console.log("Verifying KeeperHubCredits...");
  try {
    await run("verify:verify", {
      address: deployment.contracts.KeeperHubCredits,
      constructorArguments: [
        priceFeed,
        stables.usdc,
        stables.usdt,
        stables.usds,
        deployment.deployer,
      ],
    });
    console.log("KeeperHubCredits verified!");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Already Verified")) {
      console.log("KeeperHubCredits already verified");
    } else {
      console.error("Error verifying KeeperHubCredits:", message);
    }
  }

  // Verify KeeperHubTiers
  console.log("\nVerifying KeeperHubTiers...");
  try {
    await run("verify:verify", {
      address: deployment.contracts.KeeperHubTiers,
      constructorArguments: [
        priceFeed,
        stables.usdc,
        stables.usdt,
        stables.usds,
        deployment.deployer,
      ],
    });
    console.log("KeeperHubTiers verified!");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Already Verified")) {
      console.log("KeeperHubTiers already verified");
    } else {
      console.error("Error verifying KeeperHubTiers:", message);
    }
  }

  console.log("\n========================================");
  console.log("VERIFICATION COMPLETE");
  console.log("========================================");
  console.log("View on Etherscan:");
  const explorer =
    networkName === "mainnet"
      ? "https://etherscan.io"
      : "https://sepolia.etherscan.io";
  console.log(
    `Credits: ${explorer}/address/${deployment.contracts.KeeperHubCredits}#code`
  );
  console.log(
    `Tiers: ${explorer}/address/${deployment.contracts.KeeperHubTiers}#code`
  );
  console.log("========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
