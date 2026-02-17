"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FeaturedCarousel } from "@/keeperhub/components/hub/featured-carousel";
import { getWorkflowTrigger } from "@/keeperhub/components/hub/get-workflow-trigger";
import { HubHero } from "@/keeperhub/components/hub/hub-hero";
import { HubResults } from "@/keeperhub/components/hub/hub-results";
import { WorkflowSearchFilter } from "@/keeperhub/components/hub/workflow-search-filter";
import { useDebounce } from "@/keeperhub/lib/hooks/use-debounce";
import { api, type PublicTag, type SavedWorkflow } from "@/lib/api-client";

export default function HubPage() {
  // start custom KeeperHub code
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
      <div className="md:ml-[60px]">
        {isLoading ? (
          <div className="px-4 pt-28 pb-12">
            <p className="text-muted-foreground">Loading workflows...</p>
          </div>
        ) : (
          <>
            <div className="container mx-auto overflow-hidden px-4 pt-28">
              <HubHero />
            </div>

            <div className="bg-white/[0.03] py-12">
              <div className="container mx-auto px-4">
                <FeaturedCarousel workflows={featuredWorkflows} />
              </div>
            </div>

            <div className="bg-sidebar px-4 pt-8 pb-12">
              <div className="container mx-auto">
                <h2 className="mb-8 font-bold text-2xl">Community Workflows</h2>
              </div>
              <div className="container mx-auto grid grid-cols-[1fr_3fr] items-start gap-8">
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
          </>
        )}
      </div>
      {/* end custom KeeperHub code */}
    </div>
  );
}
