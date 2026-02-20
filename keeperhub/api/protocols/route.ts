import { NextResponse } from "next/server";

import "@/keeperhub/protocols";
import { getRegisteredProtocols } from "@/keeperhub/lib/protocol-registry";

export function GET(): NextResponse {
  const protocols = getRegisteredProtocols();
  return NextResponse.json(protocols);
}
