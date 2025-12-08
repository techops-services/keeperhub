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

export function GET() {
  const results: Record<string, string> = {};

  for (const key of REQUIRED_VARS) {
    const value = process.env[key];
    if (value) {
      // Show first 20 chars for verification
      const preview =
        value.length > 20 ? `${value.substring(0, 20)}...` : value;
      results[key] = `✓ ${preview}`;
    } else {
      results[key] = "❌ MISSING";
    }
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vars: results,
  });
}
