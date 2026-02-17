"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PanelState = "open" | "collapsed" | "closed";

type NavPanelStates = {
  projects: PanelState;
  tags: PanelState;
  workflows: PanelState;
};

type PersistedNavState = {
  sidebar: boolean;
  panels: NavPanelStates;
  selectedProjectId: string | null;
  selectedTagId: string | null;
};

const STORAGE_KEY = "keeperhub-nav-state";
const LEGACY_KEY = "keeperhub-sidebar-expanded";

const DEFAULT_STATE: PersistedNavState = {
  sidebar: false,
  panels: { projects: "closed", tags: "closed", workflows: "closed" },
  selectedProjectId: null,
  selectedTagId: null,
};

function loadState(): PersistedNavState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as PersistedNavState;
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const migrated: PersistedNavState = {
        ...DEFAULT_STATE,
        sidebar: legacy === "true",
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_KEY);
      return migrated;
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_STATE;
}

function applyPanelClose(
  panel: keyof NavPanelStates,
  current: PersistedNavState
): PersistedNavState {
  const panels = { ...current.panels };
  let { selectedProjectId, selectedTagId } = current;

  if (panel === "projects") {
    panels.projects = "closed";
    panels.tags = "closed";
    panels.workflows = "closed";
    selectedProjectId = null;
    selectedTagId = null;
  } else if (panel === "tags") {
    panels.tags = "closed";
    panels.workflows = "closed";
    selectedTagId = null;
  } else {
    panels.workflows = "closed";
  }

  return { ...current, panels, selectedProjectId, selectedTagId };
}

function applyPanelCollapse(
  panel: keyof NavPanelStates,
  current: PersistedNavState
): PersistedNavState {
  const panels = { ...current.panels };
  panels[panel] = "collapsed";
  return { ...current, panels };
}

function persistState(state: PersistedNavState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

type UsePersistedNavStateReturn = {
  state: PersistedNavState;
  hasMounted: boolean;
  setSidebar: (expanded: boolean) => void;
  setPanelState: (panel: keyof NavPanelStates, next: PanelState) => void;
  setSelectedProject: (id: string | null) => void;
  setSelectedTag: (id: string | null) => void;
  closeAll: () => void;
  peelRightmost: () => void;
  validateSelections: (projectIds: string[], tagIds: string[]) => void;
};

export function usePersistedNavState(): UsePersistedNavStateReturn {
  const [state, setState] = useState<PersistedNavState>(DEFAULT_STATE);
  const stateRef = useRef(state);
  const mounted = useRef(false);

  // Keep ref in sync with state
  stateRef.current = state;

  useEffect(() => {
    const loaded = loadState();
    stateRef.current = loaded;
    setState(loaded);
    mounted.current = true;
  }, []);

  const commit = useCallback((next: PersistedNavState) => {
    stateRef.current = next;
    setState(next);
    persistState(next);
  }, []);

  const setSidebar = useCallback(
    (expanded: boolean) => {
      commit({ ...stateRef.current, sidebar: expanded });
    },
    [commit]
  );

  const setPanelState = useCallback(
    (panel: keyof NavPanelStates, next: PanelState) => {
      const current = stateRef.current;

      if (next === "closed") {
        commit(applyPanelClose(panel, current));
        return;
      }

      if (next === "collapsed") {
        commit(applyPanelCollapse(panel, current));
        return;
      }

      const panels = { ...current.panels };
      panels[panel] = "open";
      commit({ ...current, panels });
    },
    [commit]
  );

  const setSelectedProject = useCallback(
    (id: string | null) => {
      commit({ ...stateRef.current, selectedProjectId: id });
    },
    [commit]
  );

  const setSelectedTag = useCallback(
    (id: string | null) => {
      commit({ ...stateRef.current, selectedTagId: id });
    },
    [commit]
  );

  const closeAll = useCallback(() => {
    commit({
      ...stateRef.current,
      panels: { projects: "closed", tags: "closed", workflows: "closed" },
      selectedProjectId: null,
      selectedTagId: null,
    });
  }, [commit]);

  const peelRightmost = useCallback(() => {
    const current = stateRef.current;
    const panels = { ...current.panels };
    let { selectedProjectId, selectedTagId } = current;

    if (panels.workflows !== "closed") {
      panels.workflows = "closed";
      if (panels.tags === "collapsed") {
        panels.tags = "open";
      }
    } else if (panels.tags !== "closed") {
      panels.tags = "closed";
      selectedTagId = null;
      if (panels.projects === "collapsed") {
        panels.projects = "open";
      }
    } else if (panels.projects !== "closed") {
      panels.projects = "closed";
      selectedProjectId = null;
    }

    commit({ ...current, panels, selectedProjectId, selectedTagId });
  }, [commit]);

  const validateSelections = useCallback(
    (projectIds: string[], tagIds: string[]) => {
      const current = stateRef.current;
      const panels = { ...current.panels };
      let { selectedProjectId, selectedTagId } = current;
      let changed = false;

      if (selectedProjectId && !projectIds.includes(selectedProjectId)) {
        selectedProjectId = null;
        panels.tags = "closed";
        panels.workflows = "closed";
        selectedTagId = null;
        changed = true;
      }

      if (
        selectedTagId &&
        selectedTagId !== "__untagged__" &&
        !tagIds.includes(selectedTagId)
      ) {
        selectedTagId = null;
        panels.workflows = "closed";
        changed = true;
      }

      if (changed) {
        commit({ ...current, panels, selectedProjectId, selectedTagId });
      }
    },
    [commit]
  );

  return {
    state,
    hasMounted: mounted.current,
    setSidebar,
    setPanelState,
    setSelectedProject,
    setSelectedTag,
    closeAll,
    peelRightmost,
    validateSelections,
  };
}

export type { NavPanelStates, PanelState, PersistedNavState };
