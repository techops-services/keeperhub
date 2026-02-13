"use client";

import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  List,
  Loader2,
  Plus,
} from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Project, SavedWorkflow, Tag } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 200;
const SNAP_THRESHOLD = (COLLAPSED_WIDTH + EXPANDED_WIDTH) / 2;
const SIDEBAR_STORAGE_KEY = "keeperhub-sidebar-expanded";

type WorkflowEntry = {
  id: string;
  name: string;
  updatedAt: string;
  projectId?: string | null;
  tagId?: string | null;
};

function groupWorkflows(workflows: WorkflowEntry[]): {
  byProject: Record<string, WorkflowEntry[]>;
  ungrouped: WorkflowEntry[];
} {
  const byProject: Record<string, WorkflowEntry[]> = {};
  const ungrouped: WorkflowEntry[] = [];

  for (const workflow of workflows) {
    if (workflow.projectId) {
      if (!byProject[workflow.projectId]) {
        byProject[workflow.projectId] = [];
      }
      byProject[workflow.projectId].push(workflow);
    } else {
      ungrouped.push(workflow);
    }
  }

  return { byProject, ungrouped };
}

const FLYOUT_WIDTH = 280;

function WorkflowItem({
  workflow,
  activeWorkflowId,
}: {
  workflow: WorkflowEntry;
  activeWorkflowId: string | undefined;
}): React.ReactNode {
  const router = useRouter();
  return (
    <button
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
        workflow.id === activeWorkflowId && "bg-muted"
      )}
      onClick={() => router.push(`/workflows/${workflow.id}`)}
      type="button"
    >
      <span className="truncate">{workflow.name}</span>
      {workflow.id === activeWorkflowId && (
        <Check className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

function ProjectFlyout({
  workflows,
  tags,
  activeWorkflowId,
  leftOffset,
  cancelClose,
  scheduleClose,
}: {
  workflows: WorkflowEntry[];
  tags: Tag[];
  activeWorkflowId: string | undefined;
  leftOffset: number;
  cancelClose: () => void;
  scheduleClose: () => void;
}): React.ReactNode {
  const tagMap = new Map(tags.map((t) => [t.id, t]));
  const byTag: Record<string, WorkflowEntry[]> = {};
  const untagged: WorkflowEntry[] = [];

  for (const w of workflows) {
    if (w.tagId) {
      if (!byTag[w.tagId]) {
        byTag[w.tagId] = [];
      }
      byTag[w.tagId].push(w);
    } else {
      untagged.push(w);
    }
  }

  const tagIds = Object.keys(byTag);

  return (
    <div
      className="pointer-events-auto fixed top-[60px] bottom-0 z-30 animate-[flyout-in_150ms_ease-out_forwards] border-r bg-background shadow-lg"
      data-flyout="project"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      role="menu"
      style={{ left: leftOffset, width: FLYOUT_WIDTH }}
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto p-2">
          {workflows.length === 0 && (
            <p className="py-4 text-center text-muted-foreground text-sm">
              No workflows
            </p>
          )}
          {workflows.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {tagIds.map((tagId, index) => {
                const tag = tagMap.get(tagId);
                return (
                  <Fragment key={tagId}>
                    {index > 0 && <div className="my-1 border-t" />}
                    <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-muted-foreground text-xs">
                      <span
                        className="inline-block size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: tag?.color ?? "#888" }}
                      />
                      {tag?.name ?? "Unknown"}
                    </div>
                    {byTag[tagId].map((w) => (
                      <WorkflowItem
                        activeWorkflowId={activeWorkflowId}
                        key={w.id}
                        workflow={w}
                      />
                    ))}
                  </Fragment>
                );
              })}
              {tagIds.length > 0 && untagged.length > 0 && (
                <div className="my-1 border-t" />
              )}
              {untagged.map((w) => (
                <WorkflowItem
                  activeWorkflowId={activeWorkflowId}
                  key={w.id}
                  workflow={w}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowsFlyout({
  activeWorkflowId,
  cancelClose,
  loading,
  projects,
  scheduleClose,
  sidebarWidth,
  tags,
  workflows,
}: {
  activeWorkflowId: string | undefined;
  cancelClose: () => void;
  loading: boolean;
  projects: Project[];
  scheduleClose: () => void;
  sidebarWidth: number;
  tags: Tag[];
  workflows: WorkflowEntry[];
}): React.ReactNode {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const projectPinnedRef = useRef(false);

  const visibleWorkflows = workflows;
  const { byProject, ungrouped } = groupWorkflows(visibleWorkflows);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const mainFlyoutLeft = sidebarWidth;
  const projectFlyoutLeft = mainFlyoutLeft + FLYOUT_WIDTH;

  return (
    <>
      <div
        className="pointer-events-auto fixed top-[60px] bottom-0 z-30 animate-[flyout-in_150ms_ease-out_forwards] border-r bg-background shadow-lg"
        data-flyout="main"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        role="menu"
        style={{ left: mainFlyoutLeft, width: FLYOUT_WIDTH }}
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-2">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && visibleWorkflows.length === 0 && (
              <p className="py-4 text-center text-muted-foreground text-sm">
                No workflows found
              </p>
            )}
            {!loading && visibleWorkflows.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {projects.map((project) => {
                  const projectWorkflows = byProject[project.id] ?? [];
                  const isActive = project.id === activeProjectId;
                  return (
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                        isActive && "bg-muted"
                      )}
                      key={project.id}
                      onClick={() => {
                        if (
                          activeProjectId === project.id &&
                          projectPinnedRef.current
                        ) {
                          projectPinnedRef.current = false;
                        } else {
                          setActiveProjectId(project.id);
                          projectPinnedRef.current = true;
                        }
                      }}
                      onMouseEnter={() => {
                        if (!projectPinnedRef.current) {
                          setActiveProjectId(project.id);
                        }
                      }}
                      type="button"
                    >
                      <span
                        className="inline-block size-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: project.color ?? "#888",
                        }}
                      />
                      <span className="truncate">{project.name}</span>
                      <span className="ml-auto flex items-center gap-1 text-muted-foreground text-xs">
                        {projectWorkflows.length}
                        <ChevronRight className="size-3.5" />
                      </span>
                    </button>
                  );
                })}

                {ungrouped.length > 0 && (
                  <>
                    {projects.length > 0 && <div className="my-1 border-t" />}
                    {ungrouped.map((w) => (
                      <WorkflowItem
                        activeWorkflowId={activeWorkflowId}
                        key={w.id}
                        workflow={w}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeProject && (
        <ProjectFlyout
          activeWorkflowId={activeWorkflowId}
          cancelClose={cancelClose}
          leftOffset={projectFlyoutLeft}
          scheduleClose={scheduleClose}
          tags={tags}
          workflows={byProject[activeProject.id] ?? []}
        />
      )}
    </>
  );
}

export function NavigationSidebar(): React.ReactNode {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [expanded, setExpanded] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true") {
      setExpanded(true);
    }
    hasMounted.current = true;
  }, []);

  useEffect(() => {
    if (hasMounted.current) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(expanded));
    }
  }, [expanded]);

  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const isDragging = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyoutPinnedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchData(): Promise<void> {
      try {
        const [w, p, t] = await Promise.all([
          api.workflow.getAll(),
          api.project.getAll(),
          api.tag.getAll(),
        ]);
        if (!cancelled) {
          setWorkflows(w);
          setProjects(p);
          setTags(t);
        }
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    }

    fetchData().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleWorkflows = workflows.filter((w) => w.name !== "__current__");

  const cancelClose = useCallback(() => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (flyoutPinnedRef.current) {
      return;
    }
    cancelClose();
    closeTimeout.current = setTimeout(() => {
      setFlyoutOpen(false);
    }, 150);
  }, [cancelClose]);

  const workflowId =
    typeof params.workflowId === "string" ? params.workflowId : undefined;
  const isHubPage = pathname === "/hub";

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      setDragWidth(expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH);

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        if (!isDragging.current) {
          return;
        }
        const newWidth = Math.min(
          EXPANDED_WIDTH,
          Math.max(COLLAPSED_WIDTH, moveEvent.clientX)
        );
        setDragWidth(newWidth);
      };

      const handleMouseUp = (upEvent: MouseEvent): void => {
        isDragging.current = false;
        const finalX = Math.min(
          EXPANDED_WIDTH,
          Math.max(COLLAPSED_WIDTH, upEvent.clientX)
        );
        setExpanded(finalX >= SNAP_THRESHOLD);
        setDragWidth(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [expanded]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: close flyout on navigation
  useEffect(() => {
    flyoutPinnedRef.current = false;
    setFlyoutOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!flyoutOpen) {
      return;
    }

    function handleMouseDown(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      if (
        sidebarRef.current?.contains(target) ||
        target.closest("[data-flyout]")
      ) {
        return;
      }
      flyoutPinnedRef.current = false;
      setFlyoutOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        flyoutPinnedRef.current = false;
        setFlyoutOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [flyoutOpen]);

  useEffect(
    () => () => {
      if (closeTimeout.current) {
        clearTimeout(closeTimeout.current);
      }
    },
    []
  );

  if (isMobile) {
    return null;
  }

  function isActive(id: string): boolean {
    if (id === "new") {
      return !(workflowId || isHubPage);
    }
    if (id === "workflows") {
      return flyoutOpen;
    }
    if (id === "hub") {
      return isHubPage;
    }
    return false;
  }

  const currentWidth =
    dragWidth ?? (expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH);
  const showLabels = currentWidth >= SNAP_THRESHOLD;

  function handleNavClick(id: string, href: string | null): void {
    if (id === "workflows") {
      if (flyoutOpen && flyoutPinnedRef.current) {
        flyoutPinnedRef.current = false;
        setFlyoutOpen(false);
      } else {
        flyoutPinnedRef.current = true;
        cancelClose();
        setFlyoutOpen(true);
      }
      return;
    }
    flyoutPinnedRef.current = false;
    setFlyoutOpen(false);
    if (href) {
      router.push(href);
    }
  }

  function handleNavHover(id: string): void {
    if (id === "workflows") {
      cancelClose();
      setFlyoutOpen(true);
    } else if (flyoutOpen && !flyoutPinnedRef.current) {
      cancelClose();
      setFlyoutOpen(false);
    }
  }

  function renderNavItem(item: {
    id: string;
    icon: typeof Plus;
    label: string;
    href: string | null;
  }): React.ReactNode {
    const disabled = item.href === null && item.id !== "workflows";
    const layoutClass = showLabels ? "gap-3 px-2" : "justify-center";

    if (disabled) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "flex h-9 w-full cursor-default items-center rounded-md text-muted-foreground transition-colors",
                layoutClass
              )}
              key={item.id}
              type="button"
            >
              <item.icon className="size-4 shrink-0" />
              {showLabels && (
                <span className="truncate text-sm">{item.label}</span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Coming Soon</TooltipContent>
        </Tooltip>
      );
    }

    const active = isActive(item.id);

    const button = (
      <button
        className={cn(
          "flex h-9 w-full items-center rounded-md transition-colors hover:bg-muted",
          layoutClass,
          active && "bg-muted"
        )}
        key={item.id}
        onClick={() => handleNavClick(item.id, item.href)}
        onMouseEnter={() => handleNavHover(item.id)}
        type="button"
      >
        <item.icon className="size-4 shrink-0" />
        {showLabels && <span className="truncate text-sm">{item.label}</span>}
      </button>
    );

    if (showLabels) {
      return button;
    }

    return (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  const navItems = [
    {
      id: "new",
      icon: Plus,
      label: "New Workflow",
      href: "/" as string | null,
    },
    {
      id: "workflows",
      icon: List,
      label: "All Workflows",
      href: null,
    },
    { id: "hub", icon: Globe, label: "Hub", href: "/hub" as string | null },
    { id: "analytics", icon: BarChart3, label: "Analytics", href: null },
  ];

  return (
    <>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: hover-based flyout dismissal */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover-based flyout dismissal */}
      <div
        className={cn(
          "pointer-events-auto fixed top-[60px] bottom-0 left-0 z-40 flex flex-col bg-background",
          dragWidth === null && "transition-[width] duration-200 ease-out"
        )}
        onMouseLeave={() => {
          if (flyoutOpen) {
            scheduleClose();
          }
        }}
        ref={sidebarRef}
        style={{ width: currentWidth }}
      >
        <nav className="flex flex-1 flex-col gap-1 overflow-hidden px-2.5 pt-3">
          {navItems.map(renderNavItem)}
        </nav>

        {/* Resize handle */}
        {/* biome-ignore lint/a11y/useSemanticElements: custom resize handle */}
        <div
          aria-orientation="vertical"
          aria-valuenow={currentWidth}
          className="group absolute inset-y-0 right-0 z-10 w-3 cursor-col-resize"
          onMouseDown={handleResizeStart}
          role="separator"
          tabIndex={0}
        >
          <div className="absolute inset-y-0 right-0 w-px bg-border transition-colors group-hover:w-1 group-hover:bg-blue-500 group-active:w-1 group-active:bg-blue-600" />
          {dragWidth === null && (
            <button
              className="absolute top-1/2 right-0 flex size-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background opacity-0 shadow-sm transition-opacity hover:bg-muted group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              type="button"
            >
              {expanded ? (
                <ChevronLeft className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Workflows flyout panel */}
      {flyoutOpen && (
        <WorkflowsFlyout
          activeWorkflowId={workflowId}
          cancelClose={cancelClose}
          loading={dataLoading}
          projects={projects}
          scheduleClose={scheduleClose}
          sidebarWidth={currentWidth}
          tags={tags}
          workflows={visibleWorkflows}
        />
      )}
    </>
  );
}
