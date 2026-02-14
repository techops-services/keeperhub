import { NextResponse } from "next/server";
import { ErrorCategory, logSystemError } from "@/keeperhub/lib/logging";
import { auth } from "@/lib/auth";

const FEEDBACK_SERVICE_URL = process.env.FEEDBACK_SERVICE_URL || "";
const FEEDBACK_API_KEY = process.env.FEEDBACK_API_KEY || "";

export async function POST(request: Request) {
  try {
    // Validate configuration
    if (!FEEDBACK_SERVICE_URL) {
      console.error("[Feedback] FEEDBACK_SERVICE_URL not configured");
      logSystemError(
        ErrorCategory.INFRASTRUCTURE,
        "[Feedback] FEEDBACK_SERVICE_URL not configured",
        new Error(
          "FEEDBACK_SERVICE_URL environment variable is not configured"
        ),
        {
          endpoint: "/api/feedback",
          component: "feedback-service",
        }
      );
      return NextResponse.json(
        { error: "Feedback service not configured" },
        { status: 500 }
      );
    }

    if (!FEEDBACK_API_KEY) {
      console.error("[Feedback] FEEDBACK_API_KEY not configured");
      logSystemError(
        ErrorCategory.INFRASTRUCTURE,
        "[Feedback] FEEDBACK_API_KEY not configured",
        new Error("FEEDBACK_API_KEY environment variable is not configured"),
        {
          endpoint: "/api/feedback",
          component: "feedback-service",
        }
      );
      return NextResponse.json(
        { error: "Feedback service not configured" },
        { status: 500 }
      );
    }

    // Get user session (optional - feedback can be submitted by authenticated users)
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Parse the incoming form data
    const formData = await request.formData();
    const message = formData.get("message") as string;
    const categories = formData.get("categories") as string;
    const screenshot = formData.get("screenshot") as File | null;

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Build form data for the feedback service
    const serviceFormData = new FormData();
    serviceFormData.append("message", message.trim());

    if (categories) {
      serviceFormData.append("categories", categories);
    }

    if (screenshot) {
      serviceFormData.append("screenshot", screenshot);
    }

    // Add user context if available
    if (session?.user) {
      serviceFormData.append("userEmail", session.user.email || "");
      serviceFormData.append("userName", session.user.name || "");
    }

    // Forward to feedback service
    const response = await fetch(FEEDBACK_SERVICE_URL, {
      method: "POST",
      headers: {
        "X-API-Key": FEEDBACK_API_KEY,
      },
      body: serviceFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Feedback] Service error:", errorData);
      return NextResponse.json(
        { error: errorData.error || "Failed to submit feedback" },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Feedback] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
