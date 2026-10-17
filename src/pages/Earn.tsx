import { AppLayout } from "@/components/layouts/AppLayout";
import { GuestCTABanner } from "@/components/guest/GuestCTABanner";
import { AuthActionGuard } from "@/components/AuthActionGuard";
import { DailyLoginReward } from "@/components/earn/DailyLoginReward";
import { EarnProgress } from "@/components/earn/EarnProgress";
import { StreakCalendar } from "@/components/earn/StreakCalendar";
import { EarlyAdopterProgress } from "@/components/earn/EarlyAdopterProgress";
import { EarnBreakdown } from "@/components/earn/EarnBreakdown";
import { FUNMoneyStatsBanner } from "@/components/earn/FUNMoneyStatsBanner";
import { MintNotificationBanner } from "@/components/mint/MintNotificationBanner";
import { LightLevelBadge } from "@/components/pplp/LightLevelBadge";
import { BehaviorSequenceTracker } from "@/components/pplp/BehaviorSequenceTracker";
import { LightActivityCategories } from "@/components/pplp/LightActivityCategories";
import { TransparencyDashboard } from "@/components/pplp/TransparencyDashboard";
import { ScoreExplanationPanel } from "@/components/pplp/ScoreExplanationPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useCamlyCoin } from "@/hooks/useCamlyCoin";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "@/lib/router-compat";
import { 
  Coins, 
  Trophy, 
  Sparkles,
  MessageCircle,
  BookOpen,
  Lightbulb,
  ArrowRight,
  Eye,
  Wallet,
  Info,
  PenLine,
  Coins as CoinsIcon
} from "lucide-react";
import camlyCoinLogo from "@/assets/camly-coin-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";


export default function Earn() {
  const { user } = useAuth();
  const { balance, lifetimeEarned, isLoading } = useCamlyCoin();
  const { t } = useLanguage();
  const [totalWithdrawn, setTotalWithdrawn] = useState<number>(0);

  // Fetch total withdrawn from user_withdrawal_stats
  useEffect(() => {
    const fetchTotalWithdrawn = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('user_withdrawal_stats')
        .select('total_withdrawn')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data) {
        setTotalWithdrawn(data.total_withdrawn || 0);
      }
    };

    fetchTotalWithdrawn();
  }, [user]);

  return (
    <AppLayout>
      {/* Daily Login Reward Popup */}
      <DailyLoginReward />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Mint Notification */}
          <MintNotificationBanner />
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              {t("earn.title")}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              {t("earn.subtitleSpiritual")}
            </p>
          </div>

          {/* Guest CTA */}
          {!user && (
            <GuestCTABanner
              title="Đăng ký để bắt đầu kiếm Camly Coin"
              description="Tạo tài khoản miễn phí để nhận thưởng từ mọi hoạt động yêu thương trên Angel AI ✨"
            />
          )}

          {/* Balance Overview */}
          <TooltipProvider>
            <div className="grid gap-4 md:grid-cols-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 cursor-help relative">
                    <Info className="absolute top-3 right-3 h-4 w-4 text-white/60" />
                    <div className="p-4 pb-2">
                      <div className="text-white/80 text-sm font-medium flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        {t("earn.balance")}
                      </div>
                    </div>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <img src={camlyCoinLogo} alt="Camly Coin" className="w-12 h-12 rounded-full" />
                        <span className="text-4xl font-bold flex items-center gap-2">
                          ✨ {isLoading ? "..." : balance.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Công thức:</p>
                  <p className="text-sm">Số dư = Tổng đã kiếm - Tổng đã rút</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bao gồm: điểm câu hỏi hợp lệ + thưởng hoạt động + thưởng Early Adopter (nếu có)
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white border-0 cursor-help relative">
                    <Info className="absolute top-3 right-3 h-4 w-4 text-white/60" />
                    <div className="p-4 pb-2">
                      <div className="text-white/80 text-sm font-medium flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        {t("earn.lifetime")}
                      </div>
                    </div>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-12 h-12" />
                        <span className="text-4xl font-bold">
                          {isLoading ? "..." : lifetimeEarned.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Công thức:</p>
                  <p className="text-sm">Tổng đã kiếm = Số dư + Tổng đã rút</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tổng tất cả Camly Coin bạn đã nhận được từ mọi hoạt động
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-0 cursor-help relative">
                    <Info className="absolute top-3 right-3 h-4 w-4 text-white/60" />
                    <div className="p-4 pb-2">
                      <div className="text-white/80 text-sm font-medium flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        {t("earn.totalWithdrawn")}
                      </div>
                    </div>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <Wallet className="w-12 h-12" />
                        <span className="text-4xl font-bold">
                          {totalWithdrawn.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Công thức:</p>
                  <p className="text-sm">Tổng đã rút = Tổng đã kiếm - Số dư</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tổng Camly Coin đã rút thành công về ví của bạn
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          {/* Early Adopter Progress */}
          <EarlyAdopterProgress />

          {/* Light Level & Sequences */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-6">
              <LightLevelBadge />
              <LightActivityCategories />
            </div>
            <div className="lg:col-span-2">
              <BehaviorSequenceTracker />
            </div>
          </div>

          {/* FUN Money Stats Banner */}
          <FUNMoneyStatsBanner userId={user?.id} />

          {/* Main content grid */}
          <div className="grid gap-6 lg:grid-cols-3 pt-4">
            {/* Earn Progress - takes 2 columns */}
            <div className="lg:col-span-2 p-6 bg-card rounded-xl border shadow-sm">
              <EarnProgress />
            </div>

            {/* Streak Calendar */}
            <div>
              <StreakCalendar />
            </div>
          </div>

          {/* Transparency Dashboard */}
          <TransparencyDashboard />

          {/* Score Explanation */}
          <ScoreExplanationPanel />

          {/* Light Profile & Proof Upload CTAs */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-primary/20 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Light Profile</h4>
                    <p className="text-xs text-muted-foreground">Xem biểu đồ 5 trụ cột & lịch sử</p>
                  </div>
                </div>
                <Link to="/light-profile">
                  <Button size="sm" variant="outline" className="gap-1">
                    Xem <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                    <PenLine className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Nộp Bằng Chứng</h4>
                    <p className="text-xs text-muted-foreground">Đính kèm proof cho hành động</p>
                  </div>
                </div>
                <Link to="/proof-upload">
                  <Button size="sm" variant="outline" className="gap-1">
                    Nộp <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Coin Breakdown */}
          <EarnBreakdown />

          {/* Withdrawal CTA */}
          <Card className="border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t("earn.withdrawTitle") || "Rút thưởng Camly Coin"}</h3>
                  <p className="text-sm text-muted-foreground">{t("earn.withdrawDesc") || "Rút Camly Coin về ví Web3 của bạn (tối thiểu 200,000)"}</p>
                </div>
              </div>
              <AuthActionGuard message="Đăng ký tài khoản để rút thưởng Camly Coin về ví Web3">
                <Link to="/profile#withdrawal">
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2">
                    <Wallet className="h-4 w-4" />
                    {t("earn.withdrawButton") || "Rút thưởng"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </AuthActionGuard>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent className="p-6 text-center">
                <Link to="/chat" className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="h-7 w-7 text-purple-600" />
                  </div>
                  <h3 className="font-semibold">{t("earn.action.askQuestion")}</h3>
                  <p className="text-xs text-muted-foreground">{t("earn.action.coinPerQuestion")}</p>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent className="p-6 text-center">
                <Link to="/profile/angel#journal" className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BookOpen className="h-7 w-7 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold">{t("earn.action.writeJournal")}</h3>
                  <p className="text-xs text-muted-foreground">{t("earn.action.coinPerJournal")}</p>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent className="p-6 text-center">
                <Link to="/ideas" className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Lightbulb className="h-7 w-7 text-yellow-600" />
                  </div>
                  <h3 className="font-semibold">{t("earn.action.submitIdea")}</h3>
                  <p className="text-xs text-muted-foreground">{t("earn.action.coinWhenApproved")}</p>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent className="p-6 text-center">
                <Link to="/vision" className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Eye className="h-7 w-7 text-pink-600" />
                  </div>
                  <h3 className="font-semibold">{t("earn.action.visionBoard")}</h3>
                  <p className="text-xs text-muted-foreground">{t("earn.action.coinFirstTime")}</p>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent className="p-6 text-center">
                <Link to="/bounty" className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Trophy className="h-7 w-7 text-orange-600" />
                  </div>
                  <h3 className="font-semibold">{t("earn.action.bountyTasks")}</h3>
                  <p className="text-xs text-muted-foreground">{t("earn.action.coinPerTask")}</p>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent className="p-6 text-center">
                <Link to="/content-writer" className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <PenLine className="h-7 w-7 text-cyan-600" />
                  </div>
                  <h3 className="font-semibold">{t("earn.action.writeContent")}</h3>
                  <p className="text-xs text-muted-foreground">{t("earn.action.contentDesc")}</p>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer group border-amber-200 dark:border-amber-800">
              <CardContent className="p-6 text-center">
                <Link to="/mint" className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CoinsIcon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-semibold">Mint FUN Money</h3>
                  <p className="text-xs text-muted-foreground">Claim token về ví Web3</p>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
