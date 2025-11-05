"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useSession } from "@/lib/auth-client";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, error } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Add a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isPending) {
        console.warn("Session check timed out, redirecting to login");

        if (pathname !== "/") {
          router.push("/");
        }
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isPending, router, pathname]);

  useEffect(() => {
    if (!(isPending || session) && pathname !== "/") {
      router.push("/");
    }
  }, [session, isPending, router, pathname]);

  // Show error if session check failed
  if (error) {
    console.error("Auth error:", error);
    if (pathname !== "/") {
      router.push("/");
    }
    return null;
  }

  // Don't block rendering while checking auth
  // The content will show immediately, and we'll redirect if needed
  return <>{children}</>;
}
