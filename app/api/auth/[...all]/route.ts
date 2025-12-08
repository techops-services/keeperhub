import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

console.log("[Auth Route] Initializing auth handlers");

try {
  const handlers = toNextJsHandler(auth);
  console.log("[Auth Route] Handlers created successfully");

  // Wrap handlers with error logging
  const wrappedGET = async (req: Request, context: unknown) => {
    try {
      console.log("[Auth Route] GET request:", req.url);
      const response = await handlers.GET(req, context);
      console.log("[Auth Route] GET response status:", response.status);
      return response;
    } catch (error) {
      console.error("[Auth Route] GET error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  };

  const wrappedPOST = async (req: Request, context: unknown) => {
    try {
      console.log("[Auth Route] POST request:", req.url);
      const response = await handlers.POST(req, context);
      console.log("[Auth Route] POST response status:", response.status);
      return response;
    } catch (error) {
      console.error("[Auth Route] POST error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  };

  export const GET = wrappedGET;
  export const POST = wrappedPOST;
} catch (error) {
  console.error("[Auth Route] Failed to create handlers:", error);
  throw error;
}
