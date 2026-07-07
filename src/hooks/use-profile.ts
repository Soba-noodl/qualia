import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  getPublicProfile,
  updateDisplayName,
  uploadAvatar,
  removeAvatar,
} from "@/services/profile.service";

export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profiles.byUser(userId ?? ""),
    queryFn: () => {
      if (!userId) throw new Error("usePublicProfile queryFn called without userId");
      return getPublicProfile(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // names rarely change mid-session
  });
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => updateDisplayName(displayName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeAvatar(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}
