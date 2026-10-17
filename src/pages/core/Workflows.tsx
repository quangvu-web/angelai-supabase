import { useState } from "react";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Gamepad2, Coins, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Cron = { schedule: string; name: string; group: "PLP" | "Game" | "Identity" | "System"; fn: string };

const crons: Cron[] = [
  { schedule: "0 1 * * *", name: "Daily epoch health", group: "PLP", fn: "cron-epoch-health" },
  { schedule: "0 4 * * *", name: "Daily vesting unlock", group: "PLP", fn: "cron-vesting-unlock" },
  { schedule: "0 5 * * 0", name: "Weekly dimensions", group: "PLP", fn: "cron-weekly-dimensions" },
  { schedule: "0 6 1 * *", name: "Monthly epoch reset", group: "PLP", fn: "cron-epoch-reset" },
  { schedule: "0 2 1 * *", name: "Anti-whale verify", group: "PLP", fn: "verify-anti-whale-cap" },
  { schedule: "17:00 UTC", name: "Quest rotate", group: "Game", fn: "cron-quest-rotate" },
  { schedule: "17:30 UTC", name: "Streak tick", group: "Game", fn: "cron-streak-tick" },
  
  { schedule: "0 17 * * *", name: "Cosmic Riddles gen", group: "Game", fn: "cron-riddles-generate" },
  { schedule: "*/30 * * * *", name: "Lamp auto-complete", group: "Game", fn: "cron-lamp-tick" },
  { schedule: "*/15 * * * *", name: "Connector indexer", group: "Identity", fn: "connector-indexer" },
  { schedule: "0 3 * * *", name: "Connector window expire", group: "Identity", fn: "connector-window-expire" },
  { schedule: "*/10 * * * *", name: "SBT auto-mint", group: "Identity", fn: "sbt-auto-mint" },
];

const groupIcon: Record<Cron["group"], React.ReactNode> = {
  PLP: <Coins className="h-3 w-3" />,
  Game: <Gamepad2 className="h-3 w-3" />,
  Identity: <ShieldCheck className="h-3 w-3" />,
  System: <Clock className="h-3 w-3" />,
};

const groupColor: Record<Cron["group"], string> = {
  PLP: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Game: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  Identity: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  System: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
};

const GROUPS: Array<Cron["group"] | "ALL"> = ["ALL", "PLP", "Game", "Identity"];

export default function Workflows() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Cron["group"] | "ALL">("ALL");
  const filtered = filter === "ALL" ? crons : crons.filter((c) => c.group === filter);

  return (
    <CorePageShell title={t("core.workflows.title")} subtitle={t("core.workflows.subtitle", { count: crons.length })}>
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {GROUPS.map((g) => (
          <Button key={g} size="sm" variant={filter === g ? "default" : "outline"} onClick={() => setFilter(g)}>
            {g === "ALL" ? t("common.all") : g} {g !== "ALL" && `(${crons.filter((c) => c.group === g).length})`}
          </Button>
        ))}
      </div>

      <Card className="p-2">
        <div className="divide-y">
          {filtered.map((c) => (
            <div key={c.name} className="flex items-center justify-between gap-3 py-2 px-2 flex-wrap">
              <div className="min-w-0">
                <div className="font-medium text-sm">{c.name}</div>
                <code className="text-[11px] text-muted-foreground font-mono">{c.fn}</code>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground font-mono">{c.schedule}</span>
                <Badge variant="outline" className={`text-[10px] gap-1 ${groupColor[c.group]}`}>
                  {groupIcon[c.group]} {c.group}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-3 mt-3 text-[11px] text-muted-foreground">
        {t("core.scheduleNote")}
      </Card>
    </CorePageShell>
  );
}
