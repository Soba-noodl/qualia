import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  getMyOrganization,
  createOrganization,
  updateOrganizationName,
  deleteOrganization,
  listOrgMembers,
  removeMember,
  cancelInvite,
} from "@/services/organizations.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

export function useMyOrganization() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.organizations.my(),
    queryFn: getMyOrganization,
    enabled: !!user,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (name: string) => createOrganization(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.my() });
      toast.success(t("teamCreated"));
    },
    onError: (err: Error) => {
      console.error("[useCreateOrganization] error:", err);
      toast.error(`${t("teamCreateError")}: ${err.message}`);
    },
  });
}

export function useUpdateOrganizationName(orgId: string) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (name: string) => updateOrganizationName(orgId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.my() });
      toast.success(t("teamNameSaved"));
    },
    onError: () => toast.error(t("teamNameSaveError")),
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (orgId: string) => deleteOrganization(orgId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.my() });
      toast.success(t("teamDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("teamDeleteError")),
  });
}

export function useOrgMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.members(orgId ?? ""),
    queryFn: () => {
      if (!orgId) throw new Error("useOrgMembers queryFn called without orgId");
      return listOrgMembers(orgId);
    },
    enabled: !!orgId,
  });
}

export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.members(orgId) });
      toast.success(t("memberRemoved"));
    },
    onError: () => toast.error(t("memberRemoveError")),
  });
}

export function useCancelInvite(orgId: string) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (memberId: string) => cancelInvite(memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.members(orgId) });
      toast.success(t("inviteCancelled"));
    },
    onError: () => toast.error(t("inviteCancelError")),
  });
}

async function callInviteMember(orgId: string, email: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await supabase.functions.invoke("invite-member", {
    body: { org_id: orgId, email },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });
  if (resp.error) throw resp.error;
}

export function useInviteMember(orgId: string) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (email: string) => callInviteMember(orgId, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.members(orgId) });
      toast.success(t("inviteSent"));
    },
    onError: () => toast.error(t("inviteSendError")),
  });
}

export function useResendInvite(orgId: string) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (email: string) => callInviteMember(orgId, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.members(orgId) });
      toast.success(t("inviteResent"));
    },
    onError: () => toast.error(t("inviteResendError")),
  });
}
