import { ethers } from "hardhat";

const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const USDT_ADDRESS = "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Using account:", signer.address);

  // Try different mint function signatures
  const mintABIs = [
    ["function mint(address to, uint256 amount)"],
    ["function mint(uint256 amount)"],
    ["function faucet(address to, uint256 amount)"],
    ["function faucet()"],
    ["function drip()"],
  ];

  console.log("\n=== Checking USDT ===");
  for (const abi of mintABIs) {
    try {
      const contract = new ethers.Contract(USDT_ADDRESS, abi, signer);
      const functionName = Object.keys(contract.interface.functions)[0].split("(")[0];

      console.log(`\nTrying ${functionName}...`);

      let tx;
      if (functionName === "mint" && abi[0].includes("to,")) {
        // mint(address to, uint256 amount)
        const amount = ethers.parseUnits("25", 6); // 25 USDT with 6 decimals
        tx = await contract.mint(signer.address, amount);
      } else if (functionName === "mint" && abi[0].includes("amount")) {
        // mint(uint256 amount)
        const amount = ethers.parseUnits("25", 6);
        tx = await contract.mint(amount);
      } else if (functionName === "faucet" && abi[0].includes("to,")) {
        // faucet(address to, uint256 amount)
        const amount = ethers.parseUnits("25", 6);
        tx = await contract.faucet(signer.address, amount);
      } else {
        // faucet() or drip() - no args
        tx = await contract[functionName]();
      }

      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("✓ Success! Tokens minted");
      break;
    } catch (error: any) {
      if (error.message.includes("no matching function")) {
        continue; // Try next ABI
      }
      console.log(`Failed: ${error.message.split("\n")[0]}`);
    }
  }

  console.log("\n=== Checking USDC ===");
  for (const abi of mintABIs) {
    try {
      const contract = new ethers.Contract(USDC_ADDRESS, abi, signer);
      const functionName = Object.keys(contract.interface.functions)[0].split("(")[0];

      console.log(`\nTrying ${functionName}...`);

      let tx;
      if (functionName === "mint" && abi[0].includes("to,")) {
        const amount = ethers.parseUnits("25", 6);
        tx = await contract.mint(signer.address, amount);
      } else if (functionName === "mint" && abi[0].includes("amount")) {
        const amount = ethers.parseUnits("25", 6);
        tx = await contract.mint(amount);
      } else if (functionName === "faucet" && abi[0].includes("to,")) {
        const amount = ethers.parseUnits("25", 6);
        tx = await contract.faucet(signer.address, amount);
      } else {
        tx = await contract[functionName]();
      }

      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("✓ Success! Tokens minted");
      break;
    } catch (error: any) {
      if (error.message.includes("no matching function")) {
        continue;
      }
      console.log(`Failed: ${error.message.split("\n")[0]}`);
    }
  }

  console.log("\n=== Checking balances ===");
  const erc20Abi = ["function balanceOf(address) view returns (uint256)"];

  const usdtContract = new ethers.Contract(USDT_ADDRESS, erc20Abi, signer);
  const usdcContract = new ethers.Contract(USDC_ADDRESS, erc20Abi, signer);

  const usdtBalance = await usdtContract.balanceOf(signer.address);
  const usdcBalance = await usdcContract.balanceOf(signer.address);

  console.log(`USDT Balance: ${ethers.formatUnits(usdtBalance, 6)}`);
  console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, 6)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
