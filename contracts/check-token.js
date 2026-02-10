const { ethers } = require("ethers");

const USDT_ADDRESS = "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

async function checkToken(address, name) {
  console.log(`\n=== ${name} (${address}) ===`);

  const code = await provider.getCode(address);
  if (code === "0x") {
    console.log("❌ No contract deployed at this address");
    return;
  }

  console.log("✓ Contract exists");

  // Try to call common view functions
  const erc20Abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
  ];

  try {
    const contract = new ethers.Contract(address, erc20Abi, provider);
    const [symbol, decimals, totalSupply] = await Promise.all([
      contract.symbol().catch(() => "Unknown"),
      contract.decimals().catch(() => "Unknown"),
      contract.totalSupply().catch(() => "Unknown"),
    ]);

    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${totalSupply}`);
  } catch (_e) {
    console.log("Could not read basic token info");
  }
}

async function main() {
  await checkToken(USDC_ADDRESS, "USDC");
  await checkToken(USDT_ADDRESS, "USDT");
}

main().catch(console.error);
