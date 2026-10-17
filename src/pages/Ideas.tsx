import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  Lightbulb,
  Send,
  ArrowRight,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  Gift,
} from "lucide-react";
import camlyCoinLogo from "@/assets/camly-coin-logo.png";


interface Idea {
  id: string;
  title: string;
  description: string;
  category: string | null;
  status: string;
  votes_count: number;
  is_rewarded: boolean;
  reward_amount: number | null;
  admin_feedback: string | null;
  created_at: string;
}

export default function Ideas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const fetchIdeas = async () => {
    try {
      if (!user) {
        // Guests can see approved/implemented ideas
        const { data, error } = await supabase
          .from("build_ideas")
          .select("*")
          .in("status", ["approved", "implemented"])
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        setIdeas(data || []);
      } else {
        // Logged-in users see all their ideas + approved ones
        const { data, error } = await supabase
          .from("build_ideas")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setIdeas(data || []);
      }
    } catch (error) {
      console.error("Error fetching ideas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("build_ideas").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "🎉 Gửi ý tưởng thành công!",
        description: "Ý tưởng của bạn đang chờ Admin duyệt. Nếu được duyệt, bạn sẽ nhận 1000 Camly Coin!",
      });

      setTitle("");
      setDescription("");
      setCategory("");
      await fetchIdeas();
    } catch (error) {
      console.error("Error submitting idea:", error);
      toast({
        title: "Lỗi",
        description: "Không thể gửi ý tưởng. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Đang chờ duyệt
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Đã duyệt
          </Badge>
        );
      case "implemented":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Sparkles className="h-3 w-3 mr-1" />
            Đã thực hiện
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Không phù hợp
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                Góp Ý Tưởng
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Chia sẻ ý tưởng, đề xuất tính năng mới để cùng xây dựng Angel AI ngày càng tốt hơn
              </p>
            </div>

            {/* Reward Banner */}
            <Card className="bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-950/30 dark:to-orange-950/30 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-6 flex items-center gap-4 flex-wrap">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <Gift className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Nhận thưởng khi ý tưởng được duyệt!
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Mỗi ý tưởng hay được Admin duyệt sẽ nhận <strong>1000 Camly Coin</strong>
                  </p>
                </div>
                <img src={camlyCoinLogo} alt="Camly Coin" className="w-12 h-12 rounded-full" />
              </CardContent>
            </Card>

            {/* Submit Form */}
            <Card className="border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50/50 to-orange-50/50 dark:from-yellow-950/20 dark:to-orange-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <Lightbulb className="h-5 w-5" />
                  Gửi ý tưởng mới
                </CardTitle>
                <CardDescription>
                  Mô tả chi tiết ý tưởng của bạn để tăng khả năng được duyệt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Tiêu đề ý tưởng *</Label>
                    <Input
                      id="title"
                      placeholder="VD: Thêm tính năng ghi chú giọng nói"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-white dark:bg-black/20"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Mô tả chi tiết *</Label>
                    <Textarea
                      id="description"
                      placeholder="Mô tả cụ thể ý tưởng của bạn: vấn đề cần giải quyết, lợi ích mang lại, cách thức hoạt động..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="bg-white dark:bg-black/20 min-h-[120px]"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Phân loại (tùy chọn)</Label>
                    <Input
                      id="category"
                      placeholder="VD: Tính năng mới, Cải thiện UI, Tối ưu hiệu suất..."
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="bg-white dark:bg-black/20"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !title.trim() || !description.trim()}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                  >
                    {isSubmitting ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                        Đang gửi...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Gửi ý tưởng
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Ideas List */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
                Ý tưởng đã gửi ({ideas.length})
              </h2>

              {isLoading && (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4 space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!isLoading && ideas.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-4">
                      <Lightbulb className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <p className="text-muted-foreground">
                      Bạn chưa gửi ý tưởng nào. Hãy chia sẻ ý tưởng đầu tiên!
                    </p>
                  </CardContent>
                </Card>
              )}

              {!isLoading &&
                ideas.map((idea) => (
                  <Card key={idea.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold">{idea.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {idea.description}
                          </p>
                        </div>
                        {getStatusBadge(idea.status)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {idea.category && (
                          <Badge variant="secondary" className="text-xs">
                            {idea.category}
                          </Badge>
                        )}
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {idea.votes_count} votes
                        </span>
                        <span>
                          {new Date(idea.created_at).toLocaleDateString("vi-VN")}
                        </span>
                      </div>

                      {idea.is_rewarded && idea.reward_amount && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                          <img src={camlyCoinLogo} alt="Camly Coin" className="w-5 h-5 rounded-full" />
                          <span className="text-sm font-medium">
                            +{idea.reward_amount.toLocaleString()} Camly Coin
                          </span>
                        </div>
                      )}

                      {idea.admin_feedback && (
                        <div className="p-3 rounded-lg bg-muted/50 text-sm">
                          <p className="font-medium text-xs text-muted-foreground mb-1">
                            Phản hồi từ Admin:
                          </p>
                          <p>{idea.admin_feedback}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        </main>
    </AppLayout>
  );
}
