import { useLocation, useNavigate } from "@/lib/router-compat";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Network, Shield, Database, Bot, Workflow, FileText,
  Activity, KeyRound, Plug, BookOpen, ShieldCheck, MessageCircle, Code,
  Globe, PanelLeft, User, ExternalLink, Gamepad2, Heart, ScrollText,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useCoordinatorRole } from "@/hooks/useCoordinatorRole";
import { ECOSYSTEM_PLATFORMS } from "@/lib/ecosystemUrls";
import { useLanguage } from "@/contexts/LanguageContext";

const coreItems = [
  { labelKey: "sidebar.dashboard", href: "/core", icon: LayoutDashboard },
  { labelKey: "sidebar.orchestration", href: "/core/orchestration", icon: Network },
  { labelKey: "sidebar.prompts", href: "/core/prompts", icon: Shield },
  { labelKey: "sidebar.memory", href: "/core/memory", icon: Database },
  { labelKey: "sidebar.agents", href: "/core/agents", icon: Bot },
  { labelKey: "sidebar.workflows", href: "/core/workflows", icon: Workflow },
  { labelKey: "sidebar.logs", href: "/core/logs", icon: FileText },
];

const ctoItems = [
  { labelKey: "sidebar.systemHealth", href: "/cto/health", icon: Activity },
  { labelKey: "sidebar.apiManagement", href: "/cto/api", icon: KeyRound },
  { labelKey: "sidebar.platforms", href: "/cto/platforms", icon: Plug },
  { labelKey: "sidebar.funCoreApi", href: "/cto/api-docs", icon: BookOpen },
  { labelKey: "sidebar.security", href: "/cto/security", icon: ShieldCheck },
  { labelKey: "sidebar.knowledge", href: "/admin/knowledge", icon: BookOpen },
];

const assistantItems = [
  { labelKey: "sidebar.chatAngel", href: "/chat", icon: MessageCircle },
  { labelKey: "sidebar.gratitude", href: "/gratitude", icon: Heart },
  { labelKey: "sidebar.embedSdk", href: "/assistant/embed", icon: Code },
];
// Mini Games sẽ chuyển hẳn sang Fun.Rich. Trong khi /games bên đó chưa dựng,
// tạm trỏ về homepage để tránh 404.
const FUN_RICH_GAMES_URL = "https://fun.rich";

export function MainSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user, isAdmin } = useAuth();
  const { hasAccess: isCoordinator } = useCoordinatorRole();
  const { t } = useLanguage();
  const canSeeCore = isAdmin || isCoordinator;
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url, display_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAvatarUrl(data.avatar_url);
          setDisplayName(data.display_name);
        }
      });
  }, [user]);

  const renderGroup = (label: string, items: typeof coreItems) => (
    <SidebarGroup>
      {!isCollapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-primary/70">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((it) => {
            const Icon = it.icon;
            const isActive = location.pathname === it.href;
            const itemLabel = t(it.labelKey);
            return (
              <SidebarMenuItem key={it.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={itemLabel}
                  className={`transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-primary to-primary-deep text-white shadow-md"
                      : "hover:bg-amber-100/70 text-foreground"
                  }`}
                >
                  <NavLink to={it.href}>
                    <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-primary"}`} />
                    <span className={`font-medium ${isActive ? "text-white" : ""}`}>{itemLabel}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-amber-200/30 !z-20">
      <SidebarHeader className="border-b border-amber-200/20 py-3 mt-5">
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between px-2"}`}>
          {isCollapsed ? (
            <SidebarTrigger className="hover:bg-amber-100/70 rounded-md p-1.5">
              <PanelLeft className="w-5 h-5 text-primary" />
            </SidebarTrigger>
          ) : (
            <>
              <NavLink to="/" className="flex flex-col leading-tight">
                <span className="text-brand-golden text-xl font-bold">Angel A.I. Core</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Intelligence Layer · FUN Ecosystem
                </span>
              </NavLink>
              <SidebarTrigger className="hover:bg-amber-100/70 rounded-md p-1.5">
                <PanelLeft className="w-5 h-5 text-primary" />
              </SidebarTrigger>
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {canSeeCore && renderGroup(t("sidebar.core"), coreItems)}
        {canSeeCore && renderGroup(t("sidebar.cto"), ctoItems)}
        {renderGroup(t("sidebar.assistant"), assistantItems)}
        {renderGroup(t("sidebar.foundationalDocs"), [
          { labelKey: "sidebar.digitalConstitution", href: "/docs/digital-constitution", icon: ScrollText },
        ])}

        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-primary/70">{t("sidebar.games")}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t("sidebar.openGames")}
                  onClick={() => window.open(FUN_RICH_GAMES_URL, "_blank", "noopener,noreferrer")}
                  className="hover:bg-amber-100/70 text-foreground"
                >
                  <Gamepad2 className="w-5 h-5 text-primary" />
                  <span className="font-medium">{t("sidebar.openFunRich")}</span>
                  {!isCollapsed && <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-primary/70">{t("sidebar.ecosystem")}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {ECOSYSTEM_PLATFORMS.map((p) => (
                <SidebarMenuItem key={p.key}>
                  <SidebarMenuButton
                    tooltip={p.name}
                    onClick={() => window.open(p.url, "_blank")}
                    className="hover:bg-amber-100/70 text-foreground"
                  >
                    <Globe className="w-5 h-5 text-primary" />
                    <span className="font-medium">{p.name}</span>
                    {!isCollapsed && <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>


      <div className="border-t border-amber-200/20">
        {user && (
          <button
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-2 w-full p-3 transition-all duration-200 hover:bg-amber-100/70 ${isCollapsed ? "justify-center" : ""}`}
          >
            <Avatar className="w-8 h-8 shrink-0 ring-2 ring-primary/30">
              <AvatarImage src={avatarUrl || undefined} alt={displayName || "Profile"} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <span className="text-sm font-medium text-foreground truncate">
                {displayName || user.email?.split("@")[0] || t("common.profile")}
              </span>
            )}
          </button>
        )}
      </div>
    </Sidebar>
  );
}

export default MainSidebar;
