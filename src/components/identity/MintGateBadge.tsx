import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMintGate } from "@/hooks/useMintGate";
import { TrustTierBadge } from "@/components/identity/TrustTierBadge";
import { ArrowUpRight } from "lucide-react";

/**
 * Visual indicator of current Mint Gate.
 * - T0: warning yellow + cap 50%
 * - T1+: full
 */
export function MintGateBadge() {
  const { data: gate, isLoading } = useMintGate();

  if (isLoading || !gate) return null;

  const isT0 = gate.tier === "T0";

  return (
    <div className={`rounded-lg border p-3 text-sm space-y-2 ${
      isT0
        ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
        : "border-emerald-500/30 bg-emerald-500/5"
    }`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <TrustTierBadge tier={gate.tier} size="sm" />
          <Badge variant="outline" className="text-xs">
            Mint cap: {(gate.cap_pct * 100).toFixed(0)}%
          </Badge>
        </div>
        {isT0 && (
          <Button asChild size="sm" variant="outline">
            <Link to="/identity">
              Nâng cấp Trust <ArrowUpRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        )}
      </div>
      {gate.warning && (
        <p className="text-xs leading-relaxed">{gate.warning}</p>
      )}
    </div>
  );
}
