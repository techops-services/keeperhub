/**
 * Global event-based sidebar refetch system
 *
 * Allows any part of the app to trigger a refetch of sidebar data
 * (workflows, projects, tags) without direct access to React hooks.
 */

type RefetchOptions = {
  closeFlyout?: boolean;
};

type RefetchCallback = (options?: RefetchOptions) => void;

const refetchCallbacks: Set<RefetchCallback> = new Set();

/**
 * Register a refetch callback (called from NavigationSidebar)
 */
export function registerSidebarRefetch(callback: RefetchCallback): () => void {
  refetchCallbacks.add(callback);

  return () => {
    refetchCallbacks.delete(callback);
  };
}

/**
 * Trigger all registered sidebar refetch callbacks.
 * Call this after org switch, project/tag changes, or any action
 * that changes sidebar data.
 */
export function refetchSidebar(options?: RefetchOptions): void {
  for (const callback of refetchCallbacks) {
    try {
      callback(options);
    } catch (error) {
      console.error("[refetchSidebar] Error in callback:", error);
    }
  }
}
