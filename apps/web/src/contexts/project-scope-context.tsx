"use client";

import { projectApi, type Project } from "@sanarwa/api-client";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useTenant } from "./tenant-context";

interface ProjectScope {
  projects: Project[];
  project: Project | undefined;
  projectId: string | undefined;
  selectProject: (projectId: string) => void;
  isLoading: boolean;
  isError: boolean;
}

const ProjectScopeContext = createContext<ProjectScope | undefined>(undefined);

/** Provider screens live inside one project; this tracks which one is selected. */
export function ProjectScopeProvider({ children }: { children: ReactNode }) {
  const { selectedTenant } = useTenant();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["projects", selectedTenant?.id, "scope"],
    queryFn: () => projectApi.getProjects({ limit: 100 }),
    enabled: Boolean(selectedTenant?.id),
    staleTime: 60_000,
  });

  const value = useMemo<ProjectScope>(() => {
    const projects = query.data?.data ?? [];
    const project = projects.find((item) => item.id === selectedId) ?? projects[0];
    return {
      projects,
      project,
      projectId: project?.id,
      selectProject: setSelectedId,
      isLoading: query.isLoading,
      isError: query.isError,
    };
  }, [query.data, query.isLoading, query.isError, selectedId]);

  return <ProjectScopeContext.Provider value={value}>{children}</ProjectScopeContext.Provider>;
}

export function useProjectScope(): ProjectScope {
  const context = useContext(ProjectScopeContext);
  if (!context) {
    throw new Error("useProjectScope must be used inside ProjectScopeProvider");
  }
  return context;
}
