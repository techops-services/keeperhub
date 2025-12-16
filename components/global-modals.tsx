"use client";

import { OverlayContainer } from "@/components/overlays/overlay-container";
import { OverlaySync } from "@/components/overlays/overlay-sync";

/**
 * Global modals and overlays that need to be rendered once at app level
 */
export function GlobalModals() {
  return (
    <>
      <OverlayContainer />
      <OverlaySync />
    </>
  );
}
