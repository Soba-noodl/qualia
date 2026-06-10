import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  getProject,
  updateProject as updateProjectService,
  type ProjectRow,
  type UpdateProjectParams,
} from "@/services/project.service";

export type Project = ProjectRow;

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ""),
    queryFn: () => {
      if (!projectId) throw new Error("useProject queryFn called without projectId");
      return getProject(projectId);
    },
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateProjectParams) =>
      updateProjectService(projectId, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.personas(projectId) });
    },
  });
}
