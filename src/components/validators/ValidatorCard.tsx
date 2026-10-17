import { Link } from "@/lib/router-compat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Coins, Users, Activity, AlertTriangle, ChevronRight } from "lucide-react";
import { TrustTierBadge } from "@/components/identity/TrustTierBadge";
import type { TrustTier } from "@/hooks/useTrustProfile";
import type { MarketplaceValidator } from "@/hooks/useValidatorMarketplace";

export function ValidatorCard({ v, index = 0 }: { v: MarketplaceValidator; index?: number }) {
  const riskColor =
    v.sybil_risk === "high"
      ? "text-destructive"
      : v.sybil_risk === "medium"
      ? "text-amber-500"
      : "";
  const uptimeColor =
    v.uptime_score >= 70
      ? "text-emerald-600 dark:text-emerald-400"
      : v.uptime_score >= 30
      ? "text-amber-500"
      : "text-muted-foreground";

  return (
    <Link
      to={`/org/${v.slug || v.did_id}`}
      className="block animate-fade-in opacity-0"
      style={{
        animationDelay: `${Math.min(index * 50, 400)}ms`,
        animationFillMode: "forwards",
      }}
    >
      <Card className="relative p-4 h-full overflow-hidden border transition-all duration-300 hover:border-primary/60 hover:shadow-lg hover:-translate-y-0.5 group">
        {/* Subtle gradient overlay on hover */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-amber-500/0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500 pointer-events-none"
        />

        <div className="relative flex items-start gap-3 mb-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-amber-500 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-border group-hover:ring-primary/40 transition">
            {v.logo_url ? (
              <img
                src={v.logo_url}
                alt={v.display_name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <ShieldCheck className="h-6 w-6 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold truncate group-hover:text-primary transition-colors">
                {v.display_name}
              </span>
              {v.is_verified && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 border-emerald-500/40">
                  <ShieldCheck className="h-2.5 w-2.5 mr-0.5 text-emerald-500" /> Verified
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <TrustTierBadge tier={(v.tier || "T0") as TrustTier} size="sm" />
              <Badge variant="secondary" className="text-[10px] h-4 px-1 capitalize">
                {v.category}
              </Badge>
              {v.sybil_risk !== "low" && (
                <span className={`flex items-center gap-0.5 text-[10px] ${riskColor}`}>
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {v.sybil_risk}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 shrink-0" />
        </div>

        {v.description && (
          <p className="relative text-xs text-muted-foreground line-clamp-2 mb-3">
            {v.description}
          </p>
        )}

        <div className="relative grid grid-cols-3 gap-2 text-xs">
          <Stat
            icon={<Coins className="h-3 w-3" />}
            label="Stake"
            value={Number(v.total_stake).toLocaleString()}
          />
          <Stat
            icon={<Users className="h-3 w-3" />}
            label="Stakers"
            value={String(v.staker_count)}
          />
          <Stat
            icon={<Activity className="h-3 w-3" />}
            label="Uptime"
            value={`${v.uptime_score}%`}
            valueClass={uptimeColor}
          />
        </div>

        <div className="relative mt-2 pt-2 border-t text-[10px] text-muted-foreground flex justify-between">
          <span>{v.attestation_count_30d} attestations / 30d</span>
          <span>weight ×{Number(v.avg_weight || 0).toFixed(1)}</span>
        </div>
      </Card>
    </Link>
  );
}

function Stat({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md bg-muted/40 p-1.5 transition-colors group-hover:bg-muted/70">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`font-mono font-semibold text-xs truncate ${valueClass || ""}`}>{value}</div>
    </div>
  );
}
