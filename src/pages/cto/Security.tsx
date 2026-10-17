import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ShieldAlert, Users, Network, Sliders, Lock } from "lucide-react";

const links = [
  { to: "/admin/fraud-alerts", title: "Fraud Alerts", desc: "Cảnh báo Sybil & gian lận", icon: <ShieldAlert className="h-4 w-4" /> },
  { to: "/admin/trust-list", title: "Trust List (WL/BL)", desc: "Whitelist / Blacklist", icon: <Lock className="h-4 w-4" /> },
  { to: "/admin/trust-engine", title: "Trust Engine", desc: "DID / SBT / DIB", icon: <Network className="h-4 w-4" /> },
  { to: "/admin/user-management", title: "User Management", desc: "Suspend, ban, recovery", icon: <Users className="h-4 w-4" /> },
  { to: "/admin/thresholds", title: "Threshold Config", desc: "Anti-farming params", icon: <Sliders className="h-4 w-4" /> },
];

export default function Security() {
  const { data } = useQuery({
    queryKey: ["security-overview"],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 86400_000).toISOString();
      const [fraudUnreviewed, fraud24h, suspended, trust] = await Promise.all([
        supabase.from("fraud_alerts").select("id", { count: "exact", head: true }).eq("is_reviewed", false),
        supabase.from("fraud_alerts").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        supabase.from("user_rate_limits").select("id", { count: "exact", head: true }).eq("is_temp_banned", true),
        supabase.from("trust_profile").select("id", { count: "exact", head: true }),
      ]);
      return {
        unreviewed: fraudUnreviewed.count ?? 0,
        last24h: fraud24h.count ?? 0,
        suspended: suspended.count ?? 0,
        trust: trust.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });

  return (
    <CorePageShell title="Security" subtitle="Fraud alerts · trust list · suspensions">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Mini icon={<ShieldAlert className="h-4 w-4" />} label="Fraud unreviewed" value={data?.unreviewed ?? "—"} highlight={(data?.unreviewed ?? 0) > 0} />
        <Mini icon={<ShieldAlert className="h-4 w-4" />} label="Fraud 24h" value={data?.last24h ?? "—"} />
        <Mini icon={<Lock className="h-4 w-4" />} label="Suspended users" value={data?.suspended ?? "—"} />
        <Mini icon={<Network className="h-4 w-4" />} label="Trust profiles" value={data?.trust ?? "—"} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {links.map((l) => (
          <Link key={l.to} to={l.to}>
            <Card className="p-4 hover:border-primary transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {l.icon}
                  <div>
                    <div className="font-semibold">{l.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{l.desc}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </CorePageShell>
  );
}

function Mini({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={`p-3 ${highlight ? "border-destructive/50" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={`text-xl font-semibold mt-1 ${highlight ? "text-destructive" : ""}`}>{value}</div>
    </Card>
  );
}
