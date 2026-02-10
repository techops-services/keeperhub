"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FeaturedCarousel } from "@/keeperhub/components/hub/featured-carousel";
import { getWorkflowTrigger } from "@/keeperhub/components/hub/get-workflow-trigger";
import { HubHero } from "@/keeperhub/components/hub/hub-hero";
import { HubResults } from "@/keeperhub/components/hub/hub-results";
import { WorkflowSearchFilter } from "@/keeperhub/components/hub/workflow-search-filter";
import { useDebounce } from "@/keeperhub/lib/hooks/use-debounce";
import { api, type SavedWorkflow } from "@/lib/api-client";

export default function HubPage() {
  // start custom KeeperHub code
  const [featuredWorkflows, setFeaturedWorkflows] = useState<SavedWorkflow[]>(
    []
  );
  const [communityWorkflows, setCommunityWorkflows] = useState<SavedWorkflow[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );
  const [selectedProtocols, setSelectedProtocols] = useState<Set<string>>(
    new Set()
  );
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const workflow of communityWorkflows) {
      if (workflow.category) {
        unique.add(workflow.category);
      }
    }
    return Array.from(unique).sort();
  }, [communityWorkflows]);

  const protocols = useMemo(() => {
    const unique = new Set<string>();
    for (const workflow of communityWorkflows) {
      if (workflow.protocol) {
        unique.add(workflow.protocol);
      }
    }
    return Array.from(unique).sort();
  }, [communityWorkflows]);

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
      selectedCategories.size > 0 ||
      selectedProtocols.size > 0 ||
      selectedTrigger
  );

  const searchResults = useMemo((): SavedWorkflow[] | null => {
    if (!isSearchActive) {
      return null;
    }

    const query = debouncedSearchQuery.trim().toLowerCase();

    let filtered = communityWorkflows;

    if (selectedCategories.size > 0) {
      filtered = filtered.filter(
        (w) => w.category && selectedCategories.has(w.category)
      );
    }

    if (selectedProtocols.size > 0) {
      filtered = filtered.filter(
        (w) => w.protocol && selectedProtocols.has(w.protocol)
      );
    }

    if (selectedTrigger) {
      filtered = filtered.filter((w) => {
        const trigger = getWorkflowTrigger(w.nodes);
        return trigger === selectedTrigger;
      });
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
    selectedCategories,
    selectedProtocols,
    selectedTrigger,
    debouncedSearchQuery,
  ]);

  useEffect(() => {
    const fetchWorkflows = async (): Promise<void> => {
      try {
        const [featured, community] = await Promise.all([
          api.workflow.getFeatured(),
          api.workflow.getPublic(),
        ]);
        setFeaturedWorkflows(featured);
        setCommunityWorkflows(community);
      } catch (error) {
        console.error("Failed to fetch workflows:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
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
      <div className="container relative mx-auto px-4 py-4 pt-28 pb-12">
        {/* start custom KeeperHub code */}
        {isLoading ? (
          <p className="text-muted-foreground">Loading workflows...</p>
        ) : (
          <>
            <HubHero />

            <div className="relative right-1/2 left-1/2 -mr-[50vw] -ml-[50vw] w-screen bg-sidebar">
              <div className="bg-white/[0.03] py-12">
                <div className="container mx-auto px-4">
                  <FeaturedCarousel workflows={featuredWorkflows} />
                </div>
              </div>
            </div>

            <div className="relative right-1/2 left-1/2 -mr-[50vw] -ml-[50vw] w-screen">
              <div className="bg-sidebar px-4 pt-8 pb-12">
                <div className="container mx-auto">
                  <h2 className="mb-8 font-bold text-2xl">
                    Community Workflows
                  </h2>
                </div>
                <div className="container mx-auto grid grid-cols-[1fr_3fr] items-start gap-8">
                  <div className="sticky top-28">
                    <WorkflowSearchFilter
                      categories={categories}
                      onCategoriesChange={setSelectedCategories}
                      onProtocolsChange={setSelectedProtocols}
                      onSearchChange={setSearchQuery}
                      onTriggerChange={setSelectedTrigger}
                      protocols={protocols}
                      searchQuery={searchQuery}
                      selectedCategories={selectedCategories}
                      selectedProtocols={selectedProtocols}
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
            </div>
          </>
        )}
        {/* end custom KeeperHub code */}
      </div>
    </div>
  );
}
