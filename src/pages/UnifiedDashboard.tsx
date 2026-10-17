import { AppLayout } from "@/components/layouts/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Globe, Sparkles, TrendingUp, Users, Coins } from "lucide-react";
import { useFUNMoneyStats } from "@/hooks/useFUNMoneyStats";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GuestCTABanner } from "@/components/guest/GuestCTABanner";

function useAngelStats(userId?: string) {
  return useQuery({
    queryKey: ["angel-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [lightRes, postsRes, chatsRes] = await Promise.all([
        supabase.from("light_score_ledger").select("final_light_score").eq("user_id", userId!),
        supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("user_id", userId!),
        supabase.from("chat_history").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      ]);
      return {
        lightScore: (lightRes.data || []).reduce((sum: number, row: any) => sum + (row.final_light_score || 0), 0),
        postsCount: postsRes.count ?? 0,
        chatsCount: chatsRes.count ?? 0,
      };
    },
  });
}

export default function UnifiedDashboard() {
  const { user, isLoading } = useAuth();
  const funStats = useFUNMoneyStats(user?.id);
  const { data: angelStats, isLoading: angelLoading } = useAngelStats(user?.id);

  // Guest access allowed - show preview UI

  const totalLS = (angelStats?.lightScore ?? 0);
  // FUN Profile LS will come from bridge API once configured
  const funProfileLS = 0;
  const combinedLS = totalLS + funProfileLS;

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            Dashboard Tổng Hợp
          </h1>
          <p className="text-muted-foreground mt-1">Tổng quan hoạt động trên Angel AI & FUN Profile</p>
        </div>

        {/* Guest CTA */}
        {!user && (
          <GuestCTABanner
            title="Đăng ký để xem Dashboard cá nhân"
            description="Tạo tài khoản miễn phí để theo dõi Light Score, FUN Money và hoạt động của bạn trên Angel AI ✨"
          />
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tổng Light Score</p>
                  <p className="text-2xl font-bold text-foreground">{combinedLS.toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tổng FUN</p>
                  <p className="text-2xl font-bold text-foreground">{funStats.totalAmount.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bài viết</p>
                  <p className="text-2xl font-bold text-foreground">{angelStats?.postsCount ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chat AI</p>
                  <p className="text-2xl font-bold text-foreground">{angelStats?.chatsCount ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Platform Breakdown */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="angel">Angel AI</TabsTrigger>
            <TabsTrigger value="fun">FUN Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> Angel AI
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Light Score</span><span className="font-semibold">{totalLS.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">FUN Scored</span><span className="font-semibold">{funStats.totalScored.toFixed(0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">FUN Minted</span><span className="font-semibold">{funStats.totalMinted.toFixed(0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bài viết</span><span className="font-semibold">{angelStats?.postsCount ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Chat</span><span className="font-semibold">{angelStats?.chatsCount ?? 0}</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" /> FUN Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground italic">
                    Dữ liệu từ FUN Profile sẽ được hiển thị khi Bridge API được kết nối.
                  </p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Light Score</span><span className="font-semibold">{funProfileLS}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Trạng thái</span><span className="text-amber-500 font-medium">Đang kết nối...</span></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="angel">
            <Card>
              <CardHeader><CardTitle>Chi tiết Angel AI</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Light Score hiện tại</span><span className="font-semibold">{totalLS.toFixed(1)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">FUN đã scored</span><span className="font-semibold">{funStats.totalScored.toFixed(0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">FUN đã minted</span><span className="font-semibold">{funStats.totalMinted.toFixed(0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">FUN đang xử lý</span><span className="font-semibold">{funStats.totalPending.toFixed(0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tổng bài viết</span><span className="font-semibold">{angelStats?.postsCount ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tổng chat AI</span><span className="font-semibold">{angelStats?.chatsCount ?? 0}</span></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fun">
            <Card>
              <CardHeader><CardTitle>Chi tiết FUN Profile</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Khi Bridge API được cấu hình, dữ liệu từ FUN Profile (fun.rich) sẽ hiển thị tại đây bao gồm Light Score, lịch sử hoạt động và thống kê tổng hợp.
                </p>
                <a
                  href="https://fun.rich"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Globe className="w-4 h-4" /> Truy cập FUN Profile
                </a>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </AppLayout>
  );
}
