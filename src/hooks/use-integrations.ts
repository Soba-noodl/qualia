import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { queryKeys } from "@/lib/query-keys";
import { useAuth } from "@/contexts/AuthContext";
import {
  checkIntegrationStatus,
  initiateOAuth,
  fetchDriveDocuments,
  fetchNotionDocuments,
  extractProjectContext,
  parseDriveUrl,
  parseNotionUrl,
  saveIntegrationDocumentsToProject,
  revokeMcpSession,
  type FetchedIntegrationDocument,
  type ExtractedProjectContext,
  type IntegrationProvider,
} from "@/services/integration.service";

export function useIntegrationStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.integrations.status(),
    queryFn: checkIntegrationStatus,
    enabled: !!user,
  });
}

export type InitiateOAuthParams =
  | IntegrationProvider
  | { provider: IntegrationProvider; returnTo?: string };

export function useInitiateOAuth() {
  return useMutation({
    mutationFn: (params: InitiateOAuthParams) => {
      const provider = typeof params === "string" ? params : params.provider;
      const returnTo = typeof params === "string" ? undefined : params.returnTo;
      return initiateOAuth(provider, returnTo ? { returnTo } : undefined);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to start connection. Please try again.");
    },
  });
}

export function useFetchIntegrationDocuments() {
  return useMutation({
    mutationFn: async (params: {
      driveIds: string[];
      notionIds: string[];
    }): Promise<FetchedIntegrationDocument[]> => {
      const [driveDocs, notionDocs] = await Promise.all([
        fetchDriveDocuments(params.driveIds),
        fetchNotionDocuments(params.notionIds),
      ]);
      return [...driveDocs, ...notionDocs];
    },
  });
}

export function useExtractProjectContext() {
  return useMutation({
    mutationFn: (docs: FetchedIntegrationDocument[]): Promise<ExtractedProjectContext> =>
      extractProjectContext(docs),
  });
}

export function useParseIntegrationUrls() {
  return {
    parseDriveUrl,
    parseNotionUrl,
  };
}

export function useSaveIntegrationDocumentsToProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // eslint-disable-next-line require-await -- TanStack mutationFn signature requires async
    mutationFn: async (params: {
      source: "drive" | "notion";
      documents: FetchedIntegrationDocument[];
    }) => {
      return saveIntegrationDocumentsToProject(
        projectId,
        params.source,
        params.documents
      );
    },
    onSuccess: () => {
      if (queryKeys.contextDocuments) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.contextDocuments(projectId),
        });
      }
    },
  });
}

export function useMcpRevoke() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeMcpSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.status() });
      toast.success("Claude disconnected.");
    },
    onError: () => {
      toast.error("Failed to disconnect Claude. Please try again.");
    },
  });
}

