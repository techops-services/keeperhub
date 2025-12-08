import { NextResponse } from "next/server";

const REQUIRED_VARS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "INTEGRATION_ENCRYPTION_KEY",
  "PARA_API_KEY",
  "PARA_ENVIRONMENT",
  "WALLET_ENCRYPTION_KEY",
  "ETHERSCAN_API_KEY",
  "SENDGRID_API_KEY",
  "FROM_ADDRESS",
  "AI_GATEWAY_API_KEY",
  "NEXT_PUBLIC_API_URL",
];

export async function GET() {
  const results: Record<string, string> = {};

  REQUIRED_VARS.forEach((key) => {
    const value = process.env[key];
    if (!value) {
      results[key] = "❌ MISSING";
    } else {
      // Show first 20 chars for verification
      const preview = value.length > 20 ? `${value.substring(0, 20)}...` : value;
      results[key] = `✓ ${preview}`;
    }
  });

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vars: results,
  });
}
