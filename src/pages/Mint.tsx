import { AppLayout } from "@/components/layouts/AppLayout";
import { GuestCTABanner } from "@/components/guest/GuestCTABanner";
import { FUNMoneyBalanceCard } from "@/components/mint/FUNMoneyBalanceCard";
import { MintActionsList } from "@/components/mint/MintActionsList";
import { TokenLifecyclePanel } from "@/components/mint/TokenLifecyclePanel";
import { MintGuideFullFlow } from "@/components/mint/MintGuideFullFlow";
import { TrustOnboardingBanner } from "@/components/identity/TrustOnboardingBanner";
import { EpochAllocationHistory } from "@/components/mint/EpochAllocationHistory";
import { FUNClaimHistory } from "@/components/mint/FUNClaimHistory";
import { AddFUNToWalletButton } from "@/components/mint/AddFUNToWalletButton";
import { MintFlowGuide } from "@/components/mint/MintFlowGuide";
import { ClaimFUNButton } from "@/components/mint/ClaimFUNButton";
import { MintNotificationBanner } from "@/components/mint/MintNotificationBanner";
import { MintOnChainPanel } from "@/components/mint/MintOnChainPanel";
import { SyncToFunRichButton } from "@/components/mint/SyncToFunRichButton";
import { MintCycleStatus } from "@/components/pplp/MintCycleStatus";
import { ThreeLayerRewardExplainer } from "@/components/pplp/ThreeLayerRewardExplainer";
import { TransparencyDashboard } from "@/components/pplp/TransparencyDashboard";
import { PPLPPhilosophy } from "@/components/pplp/PPLPPhilosophy";
import { CamlyFunRelationship } from "@/components/pplp/CamlyFunRelationship";
import { LightLevelBadge } from "@/components/pplp/LightLevelBadge";
import { ScoreExplanationPanel } from "@/components/pplp/ScoreExplanationPanel";
import { useAuth } from "@/hooks/useAuth";
import { useMintCycle } from "@/hooks/useMintCycle";
import { useFUNMoneyStats } from "@/hooks/useFUNMoneyStats";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Coins, Sparkles, Shield, Zap, ExternalLink, Info, Lock, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Mint() {
  const { user } = useAuth();
  const { currentCycle, daysRemaining } = useMintCycle();
  const { totalPending } = useFUNMoneyStats(user?.id);
 
  return (
    <AppLayout>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto space-y-8">

            {/* Trust Onboarding Banner — for T0 / no-DID users */}
            {user && <TrustOnboardingBanner />}

            {/* Dual Pathway Guide */}
            {user && (
              <Card className="border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 via-white to-blue-50 dark:from-amber-950/20 dark:via-background dark:to-blue-950/20 overflow-hidden">
                <CardContent className="p-0">
                  {/* Header */}
                  <div className="px-5 py-3 bg-gradient-to-r from-amber-100 to-blue-100 dark:from-amber-900/30 dark:to-blue-900/30 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-amber-600" />
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                        🔀 Chọn cách Mint FUN Money của bạn
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Giai đoạn chuyển tiếp — cả 2 cách đều hoạt động, kết quả được ghi nhận trên cùng hệ thống
                    </p>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-0 sm:divide-x divide-y sm:divide-y-0 divide-amber-200 dark:divide-amber-800">
                    {/* Option 1: Mint trực tiếp */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50">
                          <Coins className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                            Cách 1: Mint tại Angel AI
                          </p>
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                            ✅ Đang hoạt động
                          </span>
                        </div>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1.5 ml-1">
                        <li className="flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">①</span>
                          <span>Thực hiện Light Actions (chat, viết nhật ký, đăng bài...)</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">②</span>
                          <span>Bấm <strong>"Claim FUN"</strong> bên dưới</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">③</span>
                          <span>Chờ GOV Attesters ký duyệt → Admin submit on-chain</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">④</span>
                          <span>FUN Money về ví của bạn trên BSC Testnet</span>
                        </li>
                      </ul>
                      <p className="text-[11px] text-amber-600/80 dark:text-amber-400/60 italic">
                        💡 Phù hợp nếu bạn muốn mint nhanh ngay tại Angel AI
                      </p>
                    </div>

                    {/* Option 2: Sync về FUN.RICH */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/50">
                          <ExternalLink className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                            Cách 2: Đồng bộ về FUN.RICH
                          </p>
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                            🔄 Chuẩn bị — sẽ là cách duy nhất
                          </span>
                        </div>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1.5 ml-1">
                        <li className="flex items-start gap-1.5">
                          <span className="text-blue-500 mt-0.5">①</span>
                          <span>Bấm <strong>"Đồng bộ về FUN.RICH"</strong> bên dưới</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-blue-500 mt-0.5">②</span>
                          <span>Light Actions được gửi sang FUN.RICH tự động</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-blue-500 mt-0.5">③</span>
                          <span>Tổng hợp Light Score từ mọi platform (Angel AI + Play...)</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-blue-500 mt-0.5">④</span>
                          <span>Mint FUN tập trung tại fun.rich (sắp ra mắt)</span>
                        </li>
                      </ul>
                      <p className="text-[11px] text-blue-600/80 dark:text-blue-400/60 italic">
                        🚀 Tương lai: đây sẽ là nơi duy nhất mint FUN từ toàn hệ sinh thái
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sync to FUN.RICH */}
            {user && <SyncToFunRichButton />}

            {/* Mint FUN trực tiếp tại Angel AI */}
            {user && <ClaimFUNButton />}
            {user && <MintOnChainPanel />}
            {user && <FUNClaimHistory />}

            {/* Header */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                PureLove Protocol
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Mint FUN Money
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Claim FUN Money token (BEP-20) về ví của bạn từ các Light Actions đã được Angel AI xác nhận.
              </p>
            </div>

            {/* Guest CTA */}
            {!user && (
              <GuestCTABanner
                title="Đăng ký để Mint FUN Money"
                description="Tạo tài khoản miễn phí để tích lũy Light Score và claim FUN Money token về ví của bạn ✨"
              />
            )}

            {/* Mint Notification */}
            {user && <MintNotificationBanner />}


            {/* Important Notice */}
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700 dark:text-amber-400">Quan trọng</AlertTitle>
              <AlertDescription className="text-amber-600 dark:text-amber-300">
                FUN Money đang chạy trên <strong>BSC Testnet</strong>. Bạn cần tBNB (testnet BNB) để trả phí gas.
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-amber-700 dark:text-amber-400 p-0 h-auto ml-1"
                  onClick={() => window.open("https://testnet.bnbchain.org/faucet-smart", "_blank")}
                >
                  Lấy tBNB miễn phí <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </AlertDescription>
            </Alert>

            {/* Epoch Light Score Accumulation Banner */}
            {totalPending > 0 && (
              <Alert className="border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-emerald-700 dark:text-emerald-400">
                  ✨ Bạn đã tích lũy {totalPending.toLocaleString()} Light Score trong kỳ này!
                </AlertTitle>
                <AlertDescription className="text-emerald-600 dark:text-emerald-300">
                  FUN Money sẽ được phân bổ tự động vào cuối chu kỳ
                  {daysRemaining > 0 && <> (còn <strong>{daysRemaining} ngày</strong>)</>} dựa trên tỷ lệ đóng góp Light Score của bạn.
                  Hãy tiếp tục tích lũy để nhận nhiều FUN hơn!
                </AlertDescription>
              </Alert>
            )}

            {/* Light Level + Transparency */}
            <div className="grid gap-6 md:grid-cols-2">
              <LightLevelBadge />
              <TransparencyDashboard />
            </div>

            {/* 3 Lớp Thưởng + Chu kỳ Mint */}
            <div className="grid gap-6 md:grid-cols-2">
              <ThreeLayerRewardExplainer />
              <MintCycleStatus />
            </div>

            {/* Anti-Ego + Camly↔FUN */}
            <div className="grid gap-6 md:grid-cols-2">
              <PPLPPhilosophy />
              <CamlyFunRelationship />
            </div>


            {/* Lịch sử phân bổ FUN theo Epoch */}
            {user && <EpochAllocationHistory />}

            {/* Hướng dẫn trực quan flow mint */}
            <MintFlowGuide />

            {/* Hướng dẫn Mint FUN Money từ A đến Z */}
            <MintGuideFullFlow />
              {/* Main Layout */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Balance Card + Lifecycle - Sticky on desktop */}
                <div className="lg:col-span-1">
                  <div className="lg:sticky lg:top-24 space-y-4">
                    <FUNMoneyBalanceCard />

                    {/* Add FUN to Wallet */}
                    <div className="flex justify-center">
                      <AddFUNToWalletButton />
                    </div>

                    {/* Token Lifecycle Panel */}
                    <TokenLifecyclePanel />

                    {/* Score Explanation */}
                    <ScoreExplanationPanel />

                    {/* Quick Info */}
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <h4 className="font-medium text-sm">Cách thức hoạt động</h4>
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-start gap-2">
                            <div className="p-1 rounded-full bg-amber-100 dark:bg-amber-900/30 mt-0.5">
                              <Sparkles className="h-3 w-3 text-amber-600" />
                            </div>
                            <span>Thực hiện hành động yêu thương (chat, đăng bài, viết nhật ký...)</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5">
                              <Shield className="h-3 w-3 text-blue-600" />
                            </div>
                            <span>Angel AI chấm điểm theo 5 trụ cột PLP</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 mt-0.5">
                              <Zap className="h-3 w-3 text-green-600" />
                            </div>
                            <span>Nếu đạt Light Score ≥60, bạn Request Mint FUN</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="p-1 rounded-full bg-orange-100 dark:bg-orange-900/30 mt-0.5">
                              <Lock className="h-3 w-3 text-orange-600" />
                            </div>
                            <span>Admin phê duyệt → FUN được lock on-chain</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="p-1 rounded-full bg-purple-100 dark:bg-purple-900/30 mt-0.5">
                              <Coins className="h-3 w-3 text-purple-600" />
                            </div>
                            <span>Activate → Claim → FUN về ví của bạn</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
 
               {/* Actions List */}
               <div className="lg:col-span-2">
                 <MintActionsList />
               </div>
             </div>
 
             {/* PLP Info */}
             <div className="grid gap-4 sm:grid-cols-3 pt-4">
               <Card className="text-center p-4">
                 <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                   <span className="text-lg font-bold text-red-600">S</span>
                 </div>
                 <h4 className="font-medium">Phụng Sự</h4>
                 <p className="text-xs text-muted-foreground mt-1">Service to Others</p>
               </Card>
               <Card className="text-center p-4">
                 <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                   <span className="text-lg font-bold text-blue-600">T</span>
                 </div>
                 <h4 className="font-medium">Chân Thật</h4>
                 <p className="text-xs text-muted-foreground mt-1">Truthfulness</p>
               </Card>
               <Card className="text-center p-4">
                 <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                   <span className="text-lg font-bold text-green-600">H</span>
                 </div>
                 <h4 className="font-medium">Chữa Lành</h4>
                 <p className="text-xs text-muted-foreground mt-1">Healing</p>
               </Card>
             </div>
           </div>
         </main>
    </AppLayout>
  );
}