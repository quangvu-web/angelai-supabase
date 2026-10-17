import { useState } from "react";
import { Link } from "react-router-dom";
import { getProfilePath } from "@/lib/profileUrl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LeaderboardUser } from "@/hooks/useLeaderboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { ImageLightbox } from "@/components/community/ImageLightbox";
import angelAvatar from "@/assets/angel-avatar.png";
import { RainbowTitle } from "./RainbowTitle";
import { LeaderboardFloatingEffects } from "./LeaderboardEffects";
import { LightLevelBadge } from "./LightLevelBadge";

interface TopRankingHeroProps {
  topUsers: LeaderboardUser[];
}

function CommunityMemberCard({ 
  user, 
  delay, 
  onAvatarClick 
}: { 
  user: LeaderboardUser; 
  delay: number; 
  onAvatarClick: (url: string, name: string) => void;
}) {
  const { t } = useLanguage();
  const avatarUrl = user.avatar_url || angelAvatar;

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAvatarClick(avatarUrl, user.display_name || t("common.anonymous"));
  };

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, type: "spring", stiffness: 120 }}
    >
      {/* Avatar with soft glow */}
      <div
        className="rounded-full flex items-center justify-center cursor-pointer relative w-[60px] h-[60px] md:w-[70px] md:h-[70px]"
        style={{
          background: `linear-gradient(145deg, ${user.light_info?.color || '#94a3b8'}40, ${user.light_info?.color || '#94a3b8'}20)`,
          boxShadow: `0 4px 15px ${user.light_info?.color || '#94a3b8'}30`,
        }}
        onClick={handleAvatarClick}
      >
        <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
          <Avatar className="w-[50px] h-[50px] md:w-[58px] md:h-[58px] border-2 border-white/80">
            <AvatarImage src={avatarUrl} className="object-cover" />
            <AvatarFallback className="text-lg bg-muted text-muted-foreground font-semibold">
              {user.display_name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
        </motion.div>
      </div>

      {/* Light Level Badge */}
      <div className="mt-1">
        <LightLevelBadge lightInfo={user.light_info} size="sm" />
      </div>

      {/* User Name */}
      <Link to={getProfilePath(user.user_id)} className="group mt-0.5">
        <p className="text-xs md:text-sm font-medium text-foreground group-hover:text-primary transition-colors text-center max-w-[80px] md:max-w-[100px] leading-tight truncate">
          {user.display_name || t("common.anonymous")}
        </p>
      </Link>
    </motion.div>
  );
}

export function TopRankingHero({ topUsers }: TopRankingHeroProps) {
  const { t } = useLanguage();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: "", name: "" });
  
  const displayUsers = topUsers.slice(0, 9);

  const handleAvatarClick = (imageUrl: string, userName: string) => {
    setSelectedImage({ url: imageUrl, name: userName });
    setLightboxOpen(true);
  };

  if (displayUsers.length === 0) return null;

  return (
    <>
      <div 
        className="relative rounded-xl overflow-hidden p-3 md:p-4"
        style={{
          background: "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted)) 50%, hsl(var(--accent)) 100%)",
        }}
      >
        {/* Soft floating effects */}
        <LeaderboardFloatingEffects />

        {/* Sparkle effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary/30 rounded-full"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
              }}
              animate={{ opacity: [0, 0.6, 0], scale: [0.3, 1, 0.3] }}
              transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: Math.random() * 2 }}
            />
          ))}
        </div>

        {/* Title */}
        <motion.h2 
          className="text-center mb-3 relative z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <RainbowTitle text={`✨ ${t("leaderboard.topRanking")} ✨`} className="text-sm md:text-base" />
        </motion.h2>

        {/* Community Members Grid - No ranks, no coins */}
        <div className="relative z-10 grid grid-cols-3 gap-3 md:gap-4">
          {displayUsers.map((user, index) => (
            <CommunityMemberCard
              key={user.user_id}
              user={user}
              delay={0.1 + index * 0.08}
              onAvatarClick={handleAvatarClick}
            />
          ))}
        </div>
      </div>

      <ImageLightbox
        imageUrl={selectedImage.url}
        alt={selectedImage.name}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
