"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeaturedCarousel } from "@/keeperhub/components/hub/featured-carousel";
import { getWorkflowTrigger } from "@/keeperhub/components/hub/get-workflow-trigger";
import { HubHero } from "@/keeperhub/components/hub/hub-hero";
import { HubResults } from "@/keeperhub/components/hub/hub-results";
import { ProtocolGrid } from "@/keeperhub/components/hub/protocol-grid";
import { WorkflowSearchFilter } from "@/keeperhub/components/hub/workflow-search-filter";
import { useDebounce } from "@/keeperhub/lib/hooks/use-debounce";
import type { ProtocolDefinition } from "@/keeperhub/lib/protocol-registry";
import { api, type PublicTag, type SavedWorkflow } from "@/lib/api-client";

export default function HubPage(): React.ReactElement {
  return (
    <Suspense>
      <HubPageContent />
    </Suspense>
  );
}

function HubPageContent(): React.ReactElement {
  // start custom KeeperHub code
  const router = useRouter();
  const [featuredWorkflows, setFeaturedWorkflows] = useState<SavedWorkflow[]>(
    []
  );
  const [communityWorkflows, setCommunityWorkflows] = useState<SavedWorkflow[]>(
    []
  );
  const [publicTags, setPublicTags] = useState<PublicTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>([]);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [protocols, setProtocols] = useState<ProtocolDefinition[]>([]);
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "workflows";
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [protocolSearch, setProtocolSearch] = useState("");

  const triggers = useMemo(() => {
    const unique = new Set<string>();
    for (const workflow of communityWorkflows) {
      const trigger = getWorkflowTrigger(workflow.nodes);
      if (trigger) {
        unique.add(trigger);
      }
    }
    return Array.from(unique).sort();
  }, [communityWorkflows]);

  const isSearchActive = Boolean(
    debouncedSearchQuery.trim() ||
      selectedTrigger ||
      selectedTagSlugs.length > 0
  );

  const searchResults = useMemo((): SavedWorkflow[] | null => {
    if (!isSearchActive) {
      return null;
    }

    const query = debouncedSearchQuery.trim().toLowerCase();

    let filtered = communityWorkflows;

    if (selectedTrigger) {
      filtered = filtered.filter((w) => {
        const trigger = getWorkflowTrigger(w.nodes);
        return trigger === selectedTrigger;
      });
    }

    if (selectedTagSlugs.length > 0) {
      filtered = filtered.filter((w) =>
        w.publicTags?.some((t) => selectedTagSlugs.includes(t.slug))
      );
    }

    if (query) {
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [
    isSearchActive,
    communityWorkflows,
    selectedTrigger,
    selectedTagSlugs,
    debouncedSearchQuery,
  ]);

  const handleToggleTag = (slug: string): void => {
    setSelectedTagSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleTabChange = (val: string): void => {
    setActiveTab(val);
  };

  useEffect(() => {
    const fetchWorkflows = async (): Promise<void> => {
      try {
        const [featured, community, tags] = await Promise.all([
          api.workflow.getFeatured(),
          api.workflow.getPublic(),
          api.publicTag.getAll().catch(() => [] as PublicTag[]),
        ]);
        setFeaturedWorkflows(featured);
        setCommunityWorkflows(community);
        setPublicTags(tags);
      } catch (error) {
        console.error("Failed to fetch workflows:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  useEffect(() => {
    const fetchProtocols = async (): Promise<void> => {
      try {
        const res = await fetch("/api/protocols");
        if (res.ok) {
          const data: ProtocolDefinition[] = await res.json();
          setProtocols(data);
        }
      } catch {
        // Protocol fetch failure should not block the Hub
      }
    };

    fetchProtocols();
  }, []);
  // end custom KeeperHub code

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gradientRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const gradient = gradientRef.current;
    if (!(container && gradient)) {
      return;
    }

    const handleScroll = (): void => {
      const scrollTop = container.scrollTop;
      const fadeDistance = 500;
      const opacity = Math.max(0, 1 - scrollTop / fadeDistance);
      gradient.style.opacity = String(opacity);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="pointer-events-auto fixed inset-0 overflow-y-auto bg-sidebar [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      ref={scrollContainerRef}
    >
      {/* start custom KeeperHub code */}
      <div className="transition-[margin-left] duration-200 ease-out md:ml-[var(--nav-sidebar-width,60px)]">
        {isLoading ? (
          <div className="container mx-auto px-4 pt-20 pb-8 animate-pulse">
            {/* Hero skeleton */}
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <div className="mb-4 h-10 w-3/4 rounded bg-muted/30" />
                <div className="mb-2 h-4 w-full max-w-lg rounded bg-muted/20" />
                <div className="mb-6 h-4 w-2/3 max-w-lg rounded bg-muted/20" />
                <div className="flex gap-3">
                  <div className="h-10 w-36 rounded-md bg-muted/20" />
                  <div className="h-10 w-32 rounded-md bg-muted/20" />
                </div>
              </div>
              <div className="hidden h-[200px] rounded-lg bg-muted/10 lg:block" />
            </div>
            {/* Featured skeleton */}
            <div className="mt-10 flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  className="h-[240px] w-[280px] shrink-0 rounded-lg bg-muted/10"
                  key={`feat-${String(i)}`}
                />
              ))}
            </div>
            {/* Content skeleton */}
            <div className="mt-10">
              <div className="mx-auto mb-4 h-8 w-48 rounded bg-muted/20" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    className="h-[200px] rounded-lg bg-muted/10"
                    key={`card-${String(i)}`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <div className="container mx-auto px-4 pt-20">
                <HubHero />
              </div>
            </div>
            <div className="bg-white/[0.03] py-6 relative">
              <div className="absolute top-0 h-full bg-[#171f2e] w-full" />
              <div className="container mx-auto px-4">
                <FeaturedCarousel workflows={featuredWorkflows} />
              </div>
            </div>

            <Tabs
              defaultValue="workflows"
              onValueChange={handleTabChange}
              value={activeTab}
            >
              {/* start custom keeperhub code */}
              <div className="bg-sidebar pt-4">
                <div className="container mx-auto px-4 max-w-sm">
                  <TabsList className="w-full">
                    <TabsTrigger className="flex-1" value="workflows">
                      Workflows
                    </TabsTrigger>
                    <TabsTrigger className="flex-1" value="protocols">
                      Protocols
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
              {/* end keeperhub code */}

              <TabsContent className="bg-sidebar pt-4 pb-8" value="workflows">
                <div className="container mx-auto px-4">
                  <h2 className="mb-4 font-bold text-2xl">
                    Community Workflows
                  </h2>
                  <div className="grid grid-cols-[1fr_3fr] items-start gap-8">
                    <div className="sticky top-28">
                      <WorkflowSearchFilter
                        onSearchChange={setSearchQuery}
                        onTagToggle={handleToggleTag}
                        onTriggerChange={setSelectedTrigger}
                        publicTags={publicTags}
                        searchQuery={searchQuery}
                        selectedTagSlugs={selectedTagSlugs}
                        selectedTrigger={selectedTrigger}
                        triggers={triggers}
                      />
                    </div>

                    <HubResults
                      communityWorkflows={communityWorkflows}
                      isSearchActive={isSearchActive}
                      searchResults={searchResults}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent className="bg-sidebar pt-4 pb-8" value="protocols">
                <div className="container mx-auto px-4">
                  <div className="grid grid-cols-[1fr_3fr] items-start gap-8">
                    <div className="sticky top-28">
                      <div className="flex w-full items-center gap-2 rounded-md border border-input bg-transparent shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 min-h-10 px-3 py-1 text-sm">
                        <Search className="size-4 shrink-0 text-muted-foreground" />
                        <input
                          className="flex-1 bg-transparent placeholder:text-muted-foreground focus:outline-none"
                          onChange={(e) => setProtocolSearch(e.target.value)}
                          placeholder="Search protocols..."
                          type="text"
                          value={protocolSearch}
                        />
                        {protocolSearch && (
                          <button
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setProtocolSearch("")}
                            type="button"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <ProtocolGrid
                      onSelect={(slug) => router.push(`/hub/protocol/${slug}`)}
                      protocols={protocols}
                      searchQuery={protocolSearch}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
      {/* end custom KeeperHub code */}
    </div>
  );
}
