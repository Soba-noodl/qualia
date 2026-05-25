/**
 * Returns true if the given user can manage (delete or make-private) a project.
 * Management is allowed for the project owner or the org admin.
 */
export function canManageProject(
  userId: string | undefined,
  projectUserId: string,
  orgOwnerId: string | undefined
): boolean {
  if (!userId) return false;
  return userId === projectUserId || (!!orgOwnerId && userId === orgOwnerId);
}
