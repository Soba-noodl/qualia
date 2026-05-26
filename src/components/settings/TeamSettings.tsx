import { useState } from "react";
import { Users, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useMyOrganization,
  useCreateOrganization,
  useUpdateOrganizationName,
  useDeleteOrganization,
  useOrgMembers,
  useRemoveMember,
  useCancelInvite,
  useInviteMember,
  useResendInvite,
} from "@/hooks/use-organizations";

export function TeamSettings() {
  const { t } = useLanguage();
  const { data: org, isLoading } = useMyOrganization();
  const createOrg = useCreateOrganization();
  const updateName = useUpdateOrganizationName(org?.id ?? "");
  const deleteOrg = useDeleteOrganization();
  const { data: members = [] } = useOrgMembers(org?.id);
  const removeMember = useRemoveMember(org?.id ?? "");
  const cancelInvite = useCancelInvite(org?.id ?? "");
  const inviteMember = useInviteMember(org?.id ?? "");
  const resendInvite = useResendInvite(org?.id ?? "");

  const [nameInput, setNameInput] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [newTeamName, setNewTeamName] = useState("");

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  if (!org) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {t("teamSection")}
        </h2>
        <div className="glass rounded-xl p-8 border border-border text-center space-y-4">
          <p className="font-medium text-foreground">{t("teamEmptyTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("teamEmptyDesc")}</p>
          <div className="flex gap-2 justify-center">
            <Input
              placeholder={t("teamName")}
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="max-w-xs bg-surface-1 border-border"
            />
            <Button
              onClick={() => createOrg.mutate(newTeamName)}
              disabled={!newTeamName.trim() || createOrg.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {t("teamCreateButton")}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const activeMembers = members.filter((m) => m.status === "active");
  const pendingMembers = members.filter((m) => m.status === "pending");

  const daysUntilExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        {t("teamSection")}
      </h2>

      <div className="glass rounded-xl p-5 space-y-6 border border-border">
        {/* Team name */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">{t("teamName")}</label>
          <div className="flex gap-2">
            <Input
              value={nameInput || org.name}
              onChange={(e) => setNameInput(e.target.value)}
              className="bg-surface-1 border-border"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateName.mutate(nameInput || org.name)}
              disabled={updateName.isPending}
            >
              {t("teamNameSave")}
            </Button>
          </div>
        </div>

        {/* Active members */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{t("membersLabel")}</p>
          {activeMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-2 border-b border-border/50">
              <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {(member.invited_email[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.invited_email}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                member.role === "owner"
                  ? "bg-primary/20 text-primary"
                  : "bg-surface-2 text-muted-foreground"
              }`}>
                {member.role === "owner" ? t("roleOwner") : t("roleMember")}
              </span>
              {member.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-400 hover:bg-destructive/10 h-7"
                  onClick={() => removeMember.mutate(member.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Pending invites */}
        {pendingMembers.length > 0 && (
          <div className="space-y-1">
            {pendingMembers.map((invite) => (
              <div key={invite.id} className="flex items-center gap-3 py-2 border-b border-border/50 opacity-60">
                <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
                  {(invite.invited_email[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate text-muted-foreground">{invite.invited_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("inviteExpiry").replace("{{days}}", String(daysUntilExpiry(invite.invite_expires_at)))}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-400">
                  {t("invitePending")}
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => resendInvite.mutate(invite.invited_email)}>
                  {t("inviteResendButton")}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                  onClick={() => cancelInvite.mutate(invite.id)}>
                  {t("inviteCancelButton")}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Invite field */}
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder={t("inviteEmailPlaceholder")}
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="bg-surface-1 border-border"
          />
          <Button
            onClick={() => { inviteMember.mutate(inviteEmail); setInviteEmail(""); }}
            disabled={!inviteEmail.trim() || inviteMember.isPending}
            className="bg-primary hover:bg-primary/90 whitespace-nowrap"
          >
            {t("inviteSendButton")}
          </Button>
        </div>

        {/* Danger zone */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-sm font-semibold text-destructive">{t("teamDangerTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("teamDangerDesc")}</p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteOrg.mutate(org.id)}
            disabled={deleteOrg.isPending}
          >
            {t("teamDeleteButton")}
          </Button>
        </div>
      </div>
    </section>
  );
}
