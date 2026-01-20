import { ethers } from "hardhat";

async function main() {
  // Connect to Chainlink price feed
  const priceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    "0x694AA1769357215DE4FAC081bf1f309aDC325306" // Sepolia ETH/USD
  );

  console.log("Checking Chainlink ETH/USD Price Feed on Sepolia...\n");

  try {
    const roundData = await priceFeed.latestRoundData();

    console.log("Round Data:");
    console.log("  roundId:", roundData.roundId.toString());
    console.log(
      "  price:",
      roundData.answer.toString(),
      `($${Number(roundData.answer) / 1e8})`
    );
    console.log(
      "  startedAt:",
      new Date(Number(roundData.startedAt) * 1000).toISOString()
    );
    console.log(
      "  updatedAt:",
      new Date(Number(roundData.updatedAt) * 1000).toISOString()
    );
    console.log("  answeredInRound:", roundData.answeredInRound.toString());

    const now = Math.floor(Date.now() / 1000);
    const age = now - Number(roundData.updatedAt);
    console.log(
      "\nData Age:",
      age,
      "seconds (",
      Math.floor(age / 3600),
      "hours )"
    );
    console.log("Is Stale (>24h)?", age > 86_400);

    // Test if our contract can read it
    console.log("\nTesting our contract...");
    const credits = await ethers.getContractAt(
      "KeeperHubCredits",
      "0xfc0179B208DeB77216EE1909Ad41F2D3bC203273"
    );

    const ethPrice = await credits.getEthPrice();
    console.log(
      "✅ Contract getEthPrice() works:",
      Number(ethPrice) / 1e6,
      "USD"
    );

    const usd25 = 25_000000n;
    const credits25 = await credits.calculateCredits(usd25);
    console.log(
      "✅ calculateCredits($25) works:",
      Number(credits25),
      "credits"
    );

    const ethNeeded = await credits.usdToEth(usd25);
    console.log(
      "✅ usdToEth($25) works:",
      ethers.formatEther(ethNeeded),
      "ETH"
    );
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

main().catch(console.error);
