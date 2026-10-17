import { Link } from "react-router-dom";
import { getProfilePath } from "@/lib/profileUrl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LeaderboardUser } from "@/hooks/useLeaderboard";
import angelAvatar from "@/assets/angel-avatar.png";

interface RankingRowProps {
  user: LeaderboardUser;
  size?: "sm" | "md";
}

export function RankingRow({ user, size = "sm" }: RankingRowProps) {
  const lightIcon = user.light_info?.icon || "🌱";
  const handleText = user.handle ? `@${user.handle}` : null;
  const avatarSize = size === "md" ? "w-12 h-12" : "w-10 h-10";
  const lightLevelName = user.light_info?.name_vi || null;
  const lightLevelIcon = user.light_info?.icon || null;

  return (
    <Link
      to={getProfilePath(user.user_id, user.handle)}
      className="group block"
    >
      <div className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-[#daa520]/20 bg-gradient-to-b from-card/90 via-[#ffd700]/[0.03] to-card/90 hover:from-[#ffd700]/[0.06] hover:via-[#ffec8b]/[0.08] hover:to-[#ffd700]/[0.06] hover:border-[#daa520]/35 transition-all duration-300 hover:shadow-[0_2px_15px_rgba(218,165,32,0.12)]">
        {/* Light icon */}
        <span className="text-base drop-shadow-sm shrink-0">{lightIcon}</span>

        {/* Avatar */}
        <Avatar className={`${avatarSize} border-2 border-[#daa520]/40 shadow-[0_0_8px_rgba(255,215,0,0.15)] group-hover:border-[#ffd700]/70 transition-colors duration-300 shrink-0`}>
          <AvatarImage src={user.avatar_url || angelAvatar} className="object-cover" />
          <AvatarFallback className="text-xs font-bold bg-primary-pale text-primary-deep">
            {user.display_name?.charAt(0) || "✦"}
          </AvatarFallback>
        </Avatar>

        {/* Name + Handle */}
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-[#b8860b] transition-colors duration-300">
            {user.display_name || "Ẩn danh"}
          </p>
          {handleText && (
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {handleText}
            </p>
          )}
        </div>

        {/* Light Level Badge */}
        {lightLevelName && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#daa520]/30 text-[10px] sm:text-xs font-medium text-[#b8860b] bg-[#ffd700]/[0.08]">
            {lightLevelIcon && <span className="text-[10px]">{lightLevelIcon}</span>}
            <span className="hidden sm:inline">{lightLevelName}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
