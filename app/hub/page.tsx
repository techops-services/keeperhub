"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>();
    for (const workflow of featuredWorkflows) {
      if (workflow.category) {
        uniqueCategories.add(workflow.category);
      }
    }
    return Array.from(uniqueCategories).sort();
  }, [featuredWorkflows]);

  const isSearchActive = Boolean(
    debouncedSearchQuery.trim() || selectedCategory
  );
  const hasTextSearch = Boolean(debouncedSearchQuery.trim());

  const combinedResults = useMemo(() => {
    if (!isSearchActive) {
      return null;
    }

    const query = debouncedSearchQuery.trim().toLowerCase();

    // Filter featured workflows
    let filteredFeatured = featuredWorkflows;
    if (selectedCategory) {
      filteredFeatured = filteredFeatured.filter(
        (w) => w.category === selectedCategory
      );
    }
    if (query) {
      filteredFeatured = filteredFeatured.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.description?.toLowerCase().includes(query)
      );
    }

    // Filter community workflows (only by search, not category)
    let filteredCommunity: SavedWorkflow[] = [];
    if (query) {
      filteredCommunity = communityWorkflows.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.description?.toLowerCase().includes(query)
      );
    }

    // Merge with featured first
    return [...filteredFeatured, ...filteredCommunity];
  }, [
    isSearchActive,
    featuredWorkflows,
    communityWorkflows,
    selectedCategory,
    debouncedSearchQuery,
  ]);

  useEffect(() => {
    const fetchWorkflows = async () => {
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
    if (!container || !gradient) return;

    const handleScroll = () => {
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
      ref={scrollContainerRef}
      className="pointer-events-auto fixed inset-0 overflow-y-auto bg-sidebar [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* Fixed dot pattern behind */}
      <div
        className="pointer-events-none fixed inset-0 [background-image:radial-gradient(rgb(148_163_184_/_0.15)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      {/* Fixed gradient overlay - fades as you scroll */}
      <div
        ref={gradientRef}
        className="pointer-events-none fixed inset-x-0 top-0 h-[80vh] bg-gradient-to-b from-sidebar from-60% to-transparent"
      />
      <div className="relative container mx-auto px-4 py-4 pt-28 pb-12">
        {/* start custom KeeperHub code */}
        {isLoading ? (
          <p className="text-muted-foreground">Loading workflows...</p>
        ) : (
          <>
            <WorkflowSearchFilter
              categories={categories}
              onCategoryChange={setSelectedCategory}
              onSearchChange={setSearchQuery}
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              size="xl"
            />

            <HubResults
              combinedResults={combinedResults}
              communityWorkflows={communityWorkflows}
              featuredWorkflows={featuredWorkflows}
              hasTextSearch={hasTextSearch}
              isSearchActive={isSearchActive}
              selectedCategory={selectedCategory}
            />
          </>
        )}
        {/* end custom KeeperHub code */}
      </div>
    </div>
  );
}
