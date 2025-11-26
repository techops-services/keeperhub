"use client";

import { createContext, type ReactNode, useContext } from "react";

const GitHubStarsContext = createContext<number | null>(null);

type GitHubStarsProviderProps = {
  children: ReactNode;
  stars: number | null;
};

export function GitHubStarsProvider({
  children,
  stars,
}: GitHubStarsProviderProps) {
  return (
    <GitHubStarsContext.Provider value={stars}>
      {children}
    </GitHubStarsContext.Provider>
  );
}

export function useGitHubStars() {
  return useContext(GitHubStarsContext);
}
