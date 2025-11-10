"use client";

import { type ReactNode, useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeAnonymousSession = async () => {
      // Wait for session check to complete
      if (isPending) return;

      // If no session exists, create an anonymous session
      if (session) {
        setIsInitialized(true);
      } else {
        try {
          await authClient.signIn.anonymous();
          setIsInitialized(true);
        } catch (error) {
          console.error("Failed to create anonymous session:", error);
          // Continue anyway - the app should still work
          setIsInitialized(true);
        }
      }
    };

    initializeAnonymousSession();
  }, [session, isPending]);

  // Show loading state until initialized
  if (!isInitialized) {
    return null;
  }

  return <>{children}</>;
}
