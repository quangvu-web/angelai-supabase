import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Trophy, GraduationCap, Award, Crown } from "lucide-react";
import type { SBT, SBTType } from "@/hooks/useSBTs";
import { MintSBTOnchainButton } from "@/components/identity/MintSBTOnchainButton";

const TYPE_META: Record<
  SBTType,
  { label: string; icon: typeof CheckCircle2; gradient: string }
> = {
  identity: { label: "Identity", icon: CheckCircle2, gradient: "from-blue-500/20 to-indigo-500/20" },
  trust: { label: "Trust", icon: Sparkles, gradient: "from-amber-500/20 to-yellow-500/20" },
  contribution: { label: "Contribution", icon: Trophy, gradient: "from-emerald-500/20 to-teal-500/20" },
  credential: { label: "Credential", icon: GraduationCap, gradient: "from-purple-500/20 to-violet-500/20" },
  milestone: { label: "Milestone", icon: Award, gradient: "from-pink-500/20 to-rose-500/20" },
  legacy: { label: "Legacy", icon: Crown, gradient: "from-yellow-400/30 to-amber-400/30" },
};

export function SBTCard({ sbt }: { sbt: SBT }) {
  const meta = TYPE_META[sbt.sbt_type];
  const Icon = meta.icon;

  return (
    <Card className={`overflow-hidden border bg-gradient-to-br ${meta.gradient} backdrop-blur-sm transition hover:shadow-md`}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-background/60 p-2">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
          <Badge variant={sbt.status === "active" ? "default" : "secondary"} className="text-[10px]">
            {sbt.status}
          </Badge>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{meta.label}</div>
          <div className="font-semibold capitalize">{sbt.sbt_subtype.replace(/_/g, " ")}</div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>+{(sbt.trust_weight * 100).toFixed(0)}% trust</span>
          <span>{new Date(sbt.issued_at).toLocaleDateString("vi-VN")}</span>
        </div>
        <div className="text-[10px] text-muted-foreground/70 truncate">
          by {sbt.issuer} · {sbt.token_id.slice(0, 16)}…
        </div>
        {sbt.status === "active" && (
          <div className="pt-1">
            <MintSBTOnchainButton sbt={sbt} />
          </div>
        )}
      </div>
    </Card>
  );
}
