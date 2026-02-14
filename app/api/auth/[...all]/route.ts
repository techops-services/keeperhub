import { toNextJsHandler } from "better-auth/next-js";
import { ErrorCategory, logSystemError } from "@/keeperhub/lib/logging";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

export async function GET(req: Request) {
  try {
    return await handlers.GET(req);
  } catch (error) {
    logSystemError(ErrorCategory.AUTH, "[Auth GET] Handler error:", error, {
      endpoint: "/api/auth",
      method: "GET",
    });
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    return await handlers.POST(req);
  } catch (error) {
    logSystemError(ErrorCategory.AUTH, "[Auth POST] Handler error:", error, {
      endpoint: "/api/auth",
      method: "POST",
    });
    throw error;
  }
}
