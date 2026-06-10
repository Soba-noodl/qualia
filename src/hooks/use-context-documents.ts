import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  listContextDocuments,
  addContextDocument,
  deleteContextDocument,
  resolveAdditionalContext,
  type ContextDocumentRow,
} from "@/services/context-documents.service";
import { useAuth } from "@/contexts/AuthContext";

/** Fetch all context documents for a project. */
export function useContextDocuments(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.contextDocuments(projectId ?? ""),
    queryFn: () => {
      if (!projectId) throw new Error("useContextDocuments queryFn called without projectId");
      return listContextDocuments(projectId);
    },
    enabled: !!projectId,
  });

  // Poll every 3s while any document is missing its summary (generated async)
  const hasPendingSummary = query.data?.some((doc) => !doc.summary) ?? false;

  useQuery({
    queryKey: [...queryKeys.contextDocuments(projectId ?? ""), "summary-poll"],
    queryFn: async () => {
      if (!projectId) throw new Error("summary-poll queryFn called without projectId");
      const data = await listContextDocuments(projectId);
      if (data.every((d) => !!d.summary)) {
        queryClient.setQueryData(queryKeys.contextDocuments(projectId), data);
      }
      return data;
    },
    enabled: !!projectId && hasPendingSummary,
    refetchInterval: hasPendingSummary ? 3000 : false,
  });

  return query;
}

/** Resolve the concatenated additional-context string for a project. */
export function useAdditionalContext(projectId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.contextDocuments(projectId ?? ""), "resolved"],
    queryFn: () => {
      if (!projectId) throw new Error("useAdditionalContext queryFn called without projectId");
      return resolveAdditionalContext(projectId);
    },
    enabled: !!projectId,
  });
}

/** Upload a file as a new context document. */
export function useAddContextDocument(projectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    // eslint-disable-next-line require-await -- TanStack mutationFn signature requires async
    mutationFn: async ({
      file,
      extractedText,
    }: {
      file: File;
      extractedText: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      return addContextDocument(projectId, user.id, file, extractedText);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.contextDocuments(projectId),
      });
    },
  });
}

/** Delete a context document. */
export function useDeleteContextDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (doc: ContextDocumentRow) => deleteContextDocument(doc),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.contextDocuments(projectId),
      });
    },
  });
}
