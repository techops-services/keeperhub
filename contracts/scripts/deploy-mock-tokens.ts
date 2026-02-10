import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying mock tokens with account:", deployer.address);

  const MockERC20 = await ethers.getContractFactory("MockERC20");

  // Deploy Mock USDT (6 decimals like real USDT)
  console.log("\nDeploying Mock USDT...");
  const mockUSDT = await MockERC20.deploy("Mock Tether USD", "USDT", 6);
  await mockUSDT.waitForDeployment();
  const usdtAddress = await mockUSDT.getAddress();
  console.log("Mock USDT deployed to:", usdtAddress);

  // Deploy Mock USDS (18 decimals like real USDS)
  console.log("\nDeploying Mock USDS...");
  const mockUSDS = await MockERC20.deploy("Mock Sky Dollar", "USDS", 18);
  await mockUSDS.waitForDeployment();
  const usdsAddress = await mockUSDS.getAddress();
  console.log("Mock USDS deployed to:", usdsAddress);

  // Mint some tokens to deployer for testing
  console.log("\nMinting test tokens to deployer...");

  // Mint 1000 USDT (6 decimals)
  const usdtAmount = ethers.parseUnits("1000", 6);
  await mockUSDT.mint(deployer.address, usdtAmount);
  console.log("Minted 1000 USDT to", deployer.address);

  // Mint 1000 USDS (18 decimals)
  const usdsAmount = ethers.parseUnits("1000", 18);
  await mockUSDS.mint(deployer.address, usdsAmount);
  console.log("Minted 1000 USDS to", deployer.address);

  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("\nUpdate your .env files with these addresses:");
  console.log(`\nMock USDT: ${usdtAddress}`);
  console.log(`Mock USDS: ${usdsAddress}`);
  console.log("\nUpdate keeperhub/lib/billing/contracts.ts:");
  console.log(`
  sepolia: {
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle's official
    USDT: "${usdtAddress}",
    USDS: "${usdsAddress}",
  },
`);

  console.log("\n========================================");
  console.log("TO MINT MORE TOKENS:");
  console.log("========================================");
  console.log(`
// In browser console or script:
const usdt = new ethers.Contract("${usdtAddress}", ["function faucet(uint256)"], signer);
await usdt.faucet(ethers.parseUnits("100", 6)); // Get 100 USDT

const usds = new ethers.Contract("${usdsAddress}", ["function faucet(uint256)"], signer);
await usds.faucet(ethers.parseUnits("100", 18)); // Get 100 USDS
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
