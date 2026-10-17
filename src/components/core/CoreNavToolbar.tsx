import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Network, Shield, Database, Bot, Workflow, FileText,
  Activity, KeyRound, Plug, BookOpen, ShieldCheck, MessageCircle, Code, DollarSign,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const groups = [
  {
    labelKey: "sidebar.core",
    color: "text-amber-600 dark:text-amber-400",
    active: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    items: [
      { to: "/core", icon: LayoutDashboard, labelKey: "sidebar.dashboard" },
      { to: "/core/orchestration", icon: Network, labelKey: "sidebar.orchestration" },
      { to: "/core/prompts", icon: Shield, labelKey: "sidebar.prompts" },
      { to: "/core/memory", icon: Database, labelKey: "sidebar.memory" },
      { to: "/core/agents", icon: Bot, labelKey: "sidebar.agents" },
      { to: "/core/workflows", icon: Workflow, labelKey: "sidebar.workflows" },
      { to: "/core/logs", icon: FileText, labelKey: "sidebar.logs" },
    ],
  },
  {
    labelKey: "sidebar.cto",
    color: "text-blue-600 dark:text-blue-400",
    active: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    items: [
      { to: "/cto/health", icon: Activity, labelKey: "sidebar.systemHealth" },
      { to: "/cto/cloud-cost", icon: DollarSign, labelKey: "sidebar.cloudCost" },
      { to: "/cto/api", icon: KeyRound, labelKey: "sidebar.apiManagement" },
      { to: "/cto/platforms", icon: Plug, labelKey: "sidebar.platforms" },
      { to: "/cto/api-docs", icon: BookOpen, labelKey: "sidebar.funCoreApi" },
      { to: "/cto/security", icon: ShieldCheck, labelKey: "sidebar.security" },
      { to: "/admin/knowledge", icon: BookOpen, labelKey: "sidebar.knowledge" },
    ],
  },
  {
    labelKey: "sidebar.assistant",
    color: "text-emerald-600 dark:text-emerald-400",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    items: [
      { to: "/chat", icon: MessageCircle, labelKey: "sidebar.chatAngel" },
      { to: "/assistant/embed", icon: Code, labelKey: "sidebar.embedSdk" },
    ],
  },
];

export default function CoreNavToolbar() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  return (
    <div className="sticky top-[73px] z-40 bg-primary-pale/50 backdrop-blur-md border-b border-primary-pale">
      <div className="container mx-auto px-2 sm:px-4">
        <nav className="flex items-start flex-wrap gap-y-1 py-1.5">
          {groups.map((g, gi) => (
            <div key={g.labelKey} className="flex items-center shrink-0">
              {gi > 0 && <div className="w-px bg-border/60 mx-1.5 my-1 self-stretch min-h-[24px]" />}
              <span className={cn("hidden md:flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 shrink-0", g.color)}>
                {t(g.labelKey)}
              </span>
              <div className="flex items-center gap-0.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  const isActive = pathname === it.to;
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                        isActive ? g.active : "text-foreground-muted hover:text-foreground hover:bg-background-pure/60"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t(it.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
