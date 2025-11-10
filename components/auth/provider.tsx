"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { authClient, useSession } from "@/lib/auth-client";

export function AuthProvider({ children }: { children: ReactNode }) {
  // Temporarily disable session checking to fix infinite render loop
  // TODO: Fix anonymous auth configuration
  return <>{children}</>;
}
