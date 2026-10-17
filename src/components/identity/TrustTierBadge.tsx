import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Shield, ShieldAlert, Crown, Sparkles } from "lucide-react";
import type { TrustTier } from "@/hooks/useTrustProfile";
import { cn } from "@/lib/utils";

const TIER_META: Record<
  TrustTier,
  { label: string; icon: typeof Shield; className: string; description: string }
> = {
  T0: {
    label: "T0 — Unknown",
    icon: ShieldAlert,
    className: "bg-muted text-muted-foreground border-border",
    description: "Chưa đủ tin cậy",
  },
  T1: {
    label: "T1 — Basic",
    icon: Shield,
    className: "bg-secondary text-secondary-foreground border-border",
    description: "Dùng cơ bản",
  },
  T2: {
    label: "T2 — Verified",
    icon: ShieldCheck,
    className:
      "bg-gradient-to-r from-amber-500/15 to-yellow-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300",
    description: "Đủ điều kiện activate",
  },
  T3: {
    label: "T3 — Trusted",
    icon: Sparkles,
    className:
      "bg-gradient-to-r from-yellow-500/20 to-amber-400/30 text-amber-800 border-amber-500/60 dark:text-amber-200",
    description: "Quyền nâng cao",
  },
  T4: {
    label: "T4 — Core",
    icon: Crown,
    className:
      "bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 text-amber-900 border-yellow-500 shadow-md",
    description: "Contributor lõi",
  },
};

interface Props {
  tier: TrustTier;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TrustTierBadge({ tier, showLabel = true, size = "md", className }: Props) {
  const meta = TIER_META[tier];
  const Icon = meta.icon;
  const sizeCls =
    size === "sm" ? "text-xs px-2 py-0.5" : size === "lg" ? "text-base px-3 py-1.5" : "text-sm px-2.5 py-1";

  return (
    <Badge
      variant="outline"
      className={cn("inline-flex items-center gap-1.5 font-semibold", meta.className, sizeCls, className)}
      title={meta.description}
    >
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {showLabel && <span>{meta.label}</span>}
    </Badge>
  );
}
