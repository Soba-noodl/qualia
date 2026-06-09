import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query-keys";
import { useMyOrganization } from "@/hooks/use-organizations";
import {
  listProjects,
  createProject,
  deleteProject as deleteProjectService,
  transferProject,
  type ProjectRow,
  type ContextFileInput,
  type ProjectScope,
} from "@/services/project.service";
import { listPersonas } from "@/services/persona.service";

export type Project = ProjectRow;

export function useProjects(scope: ProjectScope = "personal", orgId?: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.projects(), scope, orgId ?? "personal"],
    queryFn: () => listProjects(scope, orgId),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}

/** For section flow: list of existing product names (from whole projects + section product_name) and fetch template for prefill */
export function useExistingProducts() {
  const { data: projects = [] } = useProjects();

  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      if (p.scope === "whole" && p.name?.trim()) {
        map.set(p.name.trim(), p.id);
      } else if (p.scope === "section" && p.product_name?.trim()) {
        if (!map.has(p.product_name.trim())) map.set(p.product_name.trim(), p.id);
      }
    }
    return Array.from(map.entries())
      .map(([name, projectId]) => ({ name, projectId }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const getTemplateForProduct = useCallback(
    async (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return null;
      const personasList = await listPersonas(projectId);
      const globalMission =
        project.scope === "whole" ? (project.mission || "") : (project.global_mission || "");
      return {
        globalMission,
        constraints: project.constraints || "",
        personas: personasList.map((p) => ({ name: p.name, description: p.description })),
      };
    },
    [projects]
  );

  return { productOptions, getTemplateForProduct };
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    // eslint-disable-next-line require-await -- TanStack mutationFn signature requires async
    mutationFn: async (params: {
      name: string;
      mission: string;
      persona: string;
      constraints: string | null;
      language: string;
      personas: Array<{ name: string; description: string }>;
      contextFiles?: ContextFileInput[];
      scope?: "whole" | "section";
      product_name?: string | null;
      global_mission?: string | null;
      org_id?: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");
      return createProject({
        ...params,
        userId: user.id,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProjectService,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    },
  });
}

export function useTransferProject() {
  const queryClient = useQueryClient();
  const { data: org } = useMyOrganization();

  return useMutation({
    mutationFn: ({
      projectId,
      orgId,
    }: {
      projectId: string;
      orgId: string | null;
    }) => transferProject(projectId, orgId, org?.id ?? null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    },
  });
}
