import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Shield, Workflow, Network, Clock, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const agents = [
  { name: "Angel Chat", role: "Embedded Universal Assistant", icon: <Bot className="h-4 w-4" />, fn: "angel-chat" },
  { name: "Coordinator", role: "Strategic workspace orchestrator", icon: <Workflow className="h-4 w-4" />, fn: "coordinator-chat" },
  { name: "Validator", role: "PLP AI Integrity scoring", icon: <Shield className="h-4 w-4" />, fn: "score-pplp-action" },
  { name: "Connector Indexer", role: "On-chain first-giver scanner", icon: <Network className="h-4 w-4" />, fn: "connector-indexer" },
  { name: "Scheduler", role: "Cron jobs (PLP + Game)", icon: <Clock className="h-4 w-4" />, fn: "cron-*" },
  { name: "Content Moderator", role: "VN regex + AI fallback", icon: <Sparkles className="h-4 w-4" />, fn: "moderate-content" },
];

export default function Agents() {
  const { t, formatNumber } = useLanguage();
  const { data: usage } = useQuery({
    queryKey: ["agents-usage-7d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("ai_usage_tracking")
        .select("usage_type, usage_count")
        .gte("usage_date", since);
      if (error) throw error;
      const total = (data ?? []).reduce((s, r) => s + r.usage_count, 0);
      const chat = (data ?? []).filter((r) => r.usage_type === "chat").reduce((s, r) => s + r.usage_count, 0);
      return { total, chat };
    },
    refetchInterval: 60_000,
  });

  return (
    <CorePageShell title={t("core.agents.title")} subtitle={t("core.agents.subtitle")}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("core.totalAgents")}</div>
          <div className="text-xl font-semibold mt-1">{agents.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("common.active")}</div>
          <div className="text-xl font-semibold mt-1 text-emerald-600">{agents.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("core.aiCalls7d")}</div>
          <div className="text-xl font-semibold mt-1">{formatNumber(usage?.total ?? 0)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("core.chatCalls7d")}</div>
          <div className="text-xl font-semibold mt-1">{formatNumber(usage?.chat ?? 0)}</div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((a) => (
          <Card key={a.name} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                {a.icon}
                {a.name}
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                {t("common.active")}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">{a.role}</div>
            <code className="text-[10px] text-muted-foreground font-mono block">edge: {a.fn}</code>
          </Card>
        ))}
      </div>
    </CorePageShell>
  );
}
