import { useEffect } from "react";
import { Link } from "@/lib/router-compat";
import { setCanonical, cleanupSeo, getSeoOrigin } from "@/lib/seoHelpers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MainSidebar } from "@/components/MainSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Shield, MessageCircle, BookOpen, ArrowRight, ExternalLink,
  Brain, Plug, Code, Compass, Sparkles,
} from "lucide-react";
import { ECOSYSTEM_PLATFORMS } from "@/lib/ecosystemUrls";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useCoordinatorRole } from "@/hooks/useCoordinatorRole";
import angelAiHeroLogo from "@/assets/angel-ai-logo-transparent.png";

const Index = () => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { hasAccess: isCoordinator } = useCoordinatorRole();
  const canSeeCore = isAdmin || isCoordinator;

  useEffect(() => {
    setCanonical(`${getSeoOrigin()}/`);
    return () => cleanupSeo();
  }, []);

  const coreCards = [
    { to: "/core", title: t("index.qa.coreTitle"), desc: t("index.qa.coreDesc"), icon: LayoutDashboard },
    { to: "/cto/health", title: t("index.qa.ctoTitle"), desc: t("index.qa.ctoDesc"), icon: Shield },
    { to: "/coordinator-gate", title: t("index.qa.workspaceTitle"), desc: t("index.qa.workspaceDesc"), icon: Compass },
    { to: "/cto/api-docs", title: t("index.qa.apiTitle"), desc: t("index.qa.apiDesc"), icon: BookOpen },
  ];
  const userCards = [
    { to: "/chat", title: t("index.qa.chatTitle"), desc: t("index.qa.chatDesc"), icon: MessageCircle },
    { to: "/assistant/embed", title: t("index.qa.embedTitle"), desc: t("index.qa.embedDesc"), icon: Code },
    { to: "/identity", title: t("index.qa.identityTitle"), desc: t("index.qa.identityDesc"), icon: Shield },
    { to: "https://fun.rich", title: t("index.qa.ecosystemTitle"), desc: t("index.qa.ecosystemDesc"), icon: Plug },
  ];
  const quickAccess = canSeeCore ? coreCards : userCards;

  const titleLines = t("index.title").split("\n");

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden relative">
        <MainSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
          <Header />
          <main className="flex-1 overflow-y-auto scrollbar-hide">
            {/* Hero */}
            <section className="relative px-4 sm:px-8 py-16 md:py-24 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50">
              <div className="max-w-5xl mx-auto text-center space-y-6 flex flex-col items-center">
                <img
                  src={angelAiHeroLogo}
                  alt="Angel AI logo"
                  className="w-40 h-40 md:w-56 md:h-56 object-contain drop-shadow-[0_8px_32px_rgba(218,165,32,0.35)]"
                  loading="eager"
                />
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#b8860b] to-[#ffd700] !text-black text-xs font-extrabold">
                  <Brain className="w-3.5 h-3.5" /> {t("index.badge")}
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] bg-clip-text text-transparent leading-tight uppercase tracking-wide">
                  {titleLines.map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < titleLines.length - 1 && <br />}
                    </span>
                  ))}
                </h1>
                <p className="text-base md:text-lg text-foreground-muted max-w-2xl mx-auto">
                  {t("index.subtitle")}{" "}
                  <a href="https://fun.rich" className="text-primary font-semibold hover:underline">Fun.Rich</a>.
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  {canSeeCore ? (
                    <>
                      <Button asChild className="bg-gradient-to-r from-[#b8860b] to-[#daa520] !text-black font-extrabold">
                        <Link to="/core">{t("index.ctaCore")} <ArrowRight className="w-4 h-4 ml-1" /></Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/chat">{t("index.ctaChat")} <MessageCircle className="w-4 h-4 ml-1" /></Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button asChild className="bg-gradient-to-r from-[#b8860b] to-[#daa520] !text-black font-extrabold">
                        <Link to="/chat">{t("index.ctaChat")} <MessageCircle className="w-4 h-4 ml-1" /></Link>
                      </Button>
                      <Button asChild variant="outline">
                        <a href="https://fun.rich" target="_blank" rel="noreferrer">
                          {t("index.ctaExplore")} <ExternalLink className="w-4 h-4 ml-1" />
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Architecture diagram */}
            <section className="px-4 sm:px-8 py-12 bg-background">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-center mb-8">{t("index.archTitle")}</h2>
                <div className="space-y-3">
                  <ArchLayer label="Camly Vision" tone="vision" />
                  <ArchArrow />
                  <ArchLayer label="Angel A.I. Core" tone="core" />
                  <ArchArrow />
                  <ArchLayer label="FUN Core API · api.fun.rich" tone="api" />
                  <ArchArrow />
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {ECOSYSTEM_PLATFORMS.map((p) => (
                      <a
                        key={p.key}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-center text-xs font-semibold p-3 rounded-lg border border-primary/20 bg-white hover:border-primary hover:shadow transition"
                      >
                        {p.name}
                      </a>
                    ))}
                  </div>
                  <ArchArrow />
                  <ArchLayer label={t("index.archAssistant")} tone="assistant" />
                </div>
              </div>
            </section>

            {/* Quick access */}
            <section className="px-4 sm:px-8 py-12 bg-amber-50/40">
              <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold text-center mb-8">{t("index.quickAccessTitle")}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {quickAccess.map((q) => {
                    const Icon = q.icon;
                    const isExternal = q.to.startsWith("http");
                    const inner = (
                      <Card className="p-5 h-full hover:border-primary transition-colors group">
                        <Icon className="w-7 h-7 text-primary mb-3" />
                        <div className="font-semibold">{q.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{q.desc}</div>
                      </Card>
                    );
                    return isExternal ? (
                      <a key={q.to} href={q.to} target="_blank" rel="noreferrer">{inner}</a>
                    ) : (
                      <Link key={q.to} to={q.to}>{inner}</Link>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Moved to Fun.Rich banner */}
            <section className="px-4 sm:px-8 py-10">
              <div className="max-w-4xl mx-auto rounded-2xl border-2 border-amber-300/60 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 p-6 md:p-8 flex flex-col md:flex-row items-center gap-5 shadow-sm">
                <Sparkles className="w-10 h-10 text-amber-600 shrink-0" />
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg md:text-xl font-extrabold text-amber-900">{t("index.movedTitle")}</h3>
                  <p className="text-sm text-amber-900/80 mt-1">{t("index.movedDesc")}</p>
                </div>
                <Button asChild className="bg-gradient-to-r from-[#b8860b] to-[#daa520] !text-black font-extrabold shrink-0">
                  <a href="https://fun.rich" target="_blank" rel="noreferrer">
                    {t("index.movedCta")} <ExternalLink className="w-4 h-4 ml-1" />
                  </a>
                </Button>
              </div>
            </section>

            {/* Ecosystem CTA */}
            <section className="px-4 sm:px-8 py-12">
              <div className="max-w-3xl mx-auto text-center space-y-4">
                <Plug className="w-10 h-10 text-primary mx-auto" />
                <h2 className="text-2xl font-bold">{t("index.ecoTitle")}</h2>
                <p className="text-sm text-foreground-muted">
                  {t("index.ecoDesc")} <strong>Fun.Rich</strong>.
                </p>
                <Button asChild size="lg" className="bg-gradient-to-r from-[#b8860b] to-[#daa520] !text-black font-extrabold">
                  <a href="https://fun.rich" target="_blank" rel="noreferrer">
                    {t("index.ecoCta")} <ExternalLink className="w-4 h-4 ml-1" />
                  </a>
                </Button>
              </div>
            </section>

            <Footer />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

const ArchLayer = ({ label, tone }: { label: string; tone: string }) => {
  const styles: Record<string, string> = {
    vision: "from-purple-500/15 to-purple-500/5 border-purple-500/30 text-purple-700 dark:text-purple-300",
    core: "from-[#b8860b]/20 to-[#ffd700]/10 border-[#daa520] !text-black font-extrabold",
    api: "from-blue-500/15 to-blue-500/5 border-blue-500/30 text-blue-700 dark:text-blue-300",
    assistant: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <div className={`text-center py-4 rounded-xl border-2 bg-gradient-to-r font-semibold ${styles[tone]}`}>
      {label}
    </div>
  );
};

const ArchArrow = () => (
  <div className="flex justify-center text-primary text-xl">↓</div>
);

export default Index;
