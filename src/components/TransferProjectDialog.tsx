import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/use-organizations";
import type { Project } from "@/services/project.service";
import type { Organization } from "@/services/organizations.service";

interface TransferProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  direction: "to-team" | "to-personal";
  org: Organization;
  onConfirm: () => void;
  isPending: boolean;
}

export default function TransferProjectDialog({
  open,
  onOpenChange,
  project,
  direction,
  org,
  onConfirm,
  isPending,
}: TransferProjectDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: members = [] } = useOrgMembers(open ? org.id : undefined);

  const activeMembers = members.filter((m) => m.status === "active");
  const otherActiveMembers = activeMembers.filter((m) => m.user_id !== user?.id);

  const fill = (key: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce(
      (str, [k, v]) => str.replaceAll(`{{${k}}}`, String(v)),
      t(key as Parameters<typeof t>[0])
    );

  if (direction === "to-team") {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="glass border-border max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {fill("moveToTeamTitle", { teamName: org.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {fill("moveToTeamDesc", {
                projectName: project.name,
                teamName: org.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="text-sm text-muted-foreground space-y-1.5 my-1 px-1">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
              {fill("moveToTeamMembersGain", { count: activeMembers.length })}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              {t("moveToTeamOwnerNote")}
            </li>
          </ul>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t("keepPrivate")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              disabled={isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {isPending ? t("saving") : t("moveToTeamConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // direction === "to-personal"
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass border-border max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("makePrivateTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {fill("makePrivateDesc", {
              projectName: project.name,
              teamName: org.name,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="text-sm text-muted-foreground space-y-1.5 my-1 px-1">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
            {fill("makePrivateOthersLose", { count: otherActiveMembers.length })}
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            {t("makePrivateAuditNote")}
          </li>
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("keepInTeam")}
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isPending}
            >
              {isPending ? t("saving") : t("makePrivate")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
