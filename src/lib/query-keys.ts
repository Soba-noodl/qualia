/** Centralized query keys for React Query. Use for cache lookup and invalidation. */
export const queryKeys = {
  all: ["qualia"] as const,
  projects: () => [...queryKeys.all, "projects"] as const,
  project: (id: string) => [...queryKeys.projects(), id] as const,
  audits: (projectId: string) => [...queryKeys.all, "audits", projectId] as const,
  auditIssueFeedback: (auditId: string) =>
    [...queryKeys.all, "auditIssueFeedback", auditId] as const,
  personas: (projectId: string) => [...queryKeys.all, "personas", projectId] as const,
  contextDocuments: (projectId: string) =>
    [...queryKeys.all, "contextDocuments", projectId] as const,
  analytics: (dateRange: { from?: Date; to?: Date } | undefined) =>
    [...queryKeys.all, "analytics", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()] as const,
  projectAuditStats: (projectIds: string[]) =>
    [...queryKeys.all, "projectAuditStats", ...projectIds.slice().sort()] as const,
  integrations: {
    status: () => [...queryKeys.all, "integrations", "status"] as const,
  },
  organizations: {
    my: () => [...queryKeys.all, "organizations", "my"] as const,
    members: (orgId: string) => [...queryKeys.all, "organizations", orgId, "members"] as const,
  },
  profiles: {
    byUser: (userId: string) => [...queryKeys.all, "profiles", userId] as const,
  },
  dailyAuditQuota: (userId: string) => [...queryKeys.all, "dailyAuditQuota", userId] as const,
  showcase: {
    list: () => [...queryKeys.all, "showcase", "list"] as const,
    audit: (slug: string) => [...queryKeys.all, "showcase", "audit", slug] as const,
  },
  llmKeys: () => [...queryKeys.all, "llm-keys"] as const,
  spendSummary: () => [...queryKeys.all, "spend-summary"] as const,
  defaultLlmProvider: () => [...queryKeys.all, "default-llm-provider"] as const,
} as const;
