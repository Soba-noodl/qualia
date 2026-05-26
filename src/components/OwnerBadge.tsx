import { useState } from "react";
import { usePublicProfile } from "@/hooks/use-profile";

/** Stable color from userId — one of 6 palette options */
function userColor(userId: string): string {
  const colors = [
    "from-violet-500 to-purple-400",
    "from-emerald-500 to-teal-400",
    "from-amber-500 to-yellow-400",
    "from-blue-500 to-sky-400",
    "from-rose-500 to-pink-400",
    "from-orange-500 to-amber-400",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}

interface OwnerBadgeProps {
  userId: string;
  /** sm = 18px avatar (breadcrumb), md = 20px avatar (dashboard card) */
  size?: "sm" | "md";
}

export function OwnerBadge({ userId, size = "sm" }: OwnerBadgeProps) {
  const { data: profile } = usePublicProfile(userId);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const displayName = profile?.display_name ?? userId.slice(0, 6);
  const initial = displayName.charAt(0).toUpperCase();
  const avatarSize = size === "sm" ? "h-[18px] w-[18px] text-[8px]" : "h-5 w-5 text-[9px]";
  const textSize = "text-[11px]";
  const showImage = !!profile?.avatar_url && !avatarBroken;

  return (
    <span className="flex items-center gap-1.5">
      {showImage ? (
        <img
          src={profile.avatar_url ?? undefined}
          alt={displayName}
          className={`${avatarSize} rounded-full object-cover flex-shrink-0`}
          onError={() => setAvatarBroken(true)}
        />
      ) : (
        <span
          className={`${avatarSize} rounded-full bg-gradient-to-br ${userColor(userId)} flex items-center justify-center font-bold text-white flex-shrink-0`}
          aria-hidden="true"
        >
          {initial}
        </span>
      )}
      {size === "sm" && (
        <span className={`${textSize} text-muted-foreground`}>{displayName}</span>
      )}
    </span>
  );
}
