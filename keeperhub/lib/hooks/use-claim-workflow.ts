"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmOverlay } from "@/components/overlays/confirm-overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { api } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";

const STORAGE_KEY = "pendingWorkflowClaim";

type PendingClaim = {
  workflowId: string;
  previousUserId: string;
};

export function getPendingClaim(): PendingClaim | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setPendingClaim(claim: PendingClaim) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(claim));
}

export function clearPendingClaim() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useClaimWorkflow(
  workflowId: string,
  loadExistingWorkflow: () => Promise<void>
) {
  const { data: session } = useSession();
  const { open } = useOverlay();
  const router = useRouter();
  const [claimPending, setClaimPending] = useState(() => {
    const claim = getPendingClaim();
    return claim?.workflowId === workflowId;
  });
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (hasShownRef.current) {
      return;
    }

    const claim = getPendingClaim();
    if (!claim || claim.workflowId !== workflowId) {
      setClaimPending(false);
      return;
    }

    const isAuthenticated =
      session?.user?.id &&
      !session.user.email?.startsWith("temp-") &&
      session.user.name !== "Anonymous";

    const isDifferentUser = session?.user?.id !== claim.previousUserId;

    if (!(isAuthenticated && isDifferentUser)) {
      return;
    }

    hasShownRef.current = true;

    open(ConfirmOverlay, {
      title: "Move workflow to your organization?",
      message:
        "This workflow was created before you signed in. Would you like to save it to your organization?",
      confirmLabel: "Yes, move it",
      cancelLabel: "No thanks",
      onConfirm: async () => {
        try {
          await api.workflow.claim(workflowId);
          clearPendingClaim();
          setClaimPending(false);
          toast.success("Workflow moved to your organization");
          await loadExistingWorkflow();
        } catch (error) {
          console.error("Failed to claim workflow:", error);
          toast.error("Failed to move workflow");
          clearPendingClaim();
          setClaimPending(false);
        }
      },
      onCancel: () => {
        clearPendingClaim();
        setClaimPending(false);
        router.push("/");
      },
    });
  }, [session, workflowId, open, loadExistingWorkflow, router]);

  return { claimPending };
}
