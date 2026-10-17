import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, ImagePlus, Eye, Paintbrush, RefreshCw, Calendar, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { AiProviderMixCard } from "@/components/admin/AiProviderMixCard";
import { AiRoutingLockCard } from "@/components/admin/AiRoutingLockCard";
import { CloudFootprintCard } from "@/components/admin/CloudFootprintCard";


interface UsageStats {
  usage_type: string;
  total_count: number;
  unique_users: number;
}

interface DailyUsage {
  usage_date: string;
  chat: number;
  generate_image: number;
  analyze_image: number;
  edit_image: number;
}

export default function AdminAIUsage() {
  const { isAdmin, isAdminChecked } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UsageStats[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cacheSearch, setCacheSearch] = useState("");
  const [cacheHits, setCacheHits] = useState<Array<{ question_normalized: string; hit_count: number; last_used_at: string | null }>>([]);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [imgErrorRates, setImgErrorRates] = useState<Array<{ error_code: string; provider: string; event_count: number; pct: number }>>([]);
  const [imgErrorDays, setImgErrorDays] = useState<number>(7);

  const fetchImageErrorRates = async (days = imgErrorDays) => {
    try {
      const { data, error } = await supabase.rpc("get_image_error_rates", { _days: days });
      if (error) throw error;
      setImgErrorRates((data as any[])?.map(r => ({
        error_code: r.error_code,
        provider: r.provider,
        event_count: Number(r.event_count),
        pct: Number(r.pct),
      })) ?? []);
    } catch (e: any) {
      console.error("Error fetching image error rates:", e);
    }
  };


  const searchCache = async () => {
    const q = cacheSearch.trim();
    if (!q) { setCacheHits([]); return; }
    setCacheBusy(true);
    try {
      const { data, error } = await supabase
        .from('cached_responses')
        .select('question_normalized, hit_count, last_used_at')
        .ilike('question_normalized', `%${q.toLowerCase()}%`)
        .order('last_used_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setCacheHits(data || []);
    } catch (e: any) {
      toast.error("Lỗi tìm cache: " + e.message);
    } finally {
      setCacheBusy(false);
    }
  };

  const deleteCache = async (normalized: string) => {
    if (!confirm(`Xoá cache cho câu:\n"${normalized}"?`)) return;
    try {
      const { error } = await supabase
        .from('cached_responses')
        .delete()
        .eq('question_normalized', normalized);
      if (error) throw error;
      toast.success("Đã xoá cache");
      setCacheHits(prev => prev.filter(r => r.question_normalized !== normalized));
    } catch (e: any) {
      toast.error("Lỗi xoá cache: " + e.message);
    }
  };

  useEffect(() => {
    if (isAdminChecked && !isAdmin) {
      navigate("/admin/login");
    }
  }, [isAdmin, isAdminChecked, navigate]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // Fetch aggregate stats
      const { data: aggregateData, error: aggError } = await supabase
        .from('ai_usage_tracking')
        .select('usage_type, usage_count, user_id');

      if (aggError) throw aggError;

      // Process aggregate data
      const statsMap: Record<string, { total: number; users: Set<string> }> = {};
      (aggregateData || []).forEach((row: any) => {
        if (!statsMap[row.usage_type]) {
          statsMap[row.usage_type] = { total: 0, users: new Set() };
        }
        statsMap[row.usage_type].total += row.usage_count;
        statsMap[row.usage_type].users.add(row.user_id);
      });

      const processedStats = Object.entries(statsMap).map(([type, data]) => ({
        usage_type: type,
        total_count: data.total,
        unique_users: data.users.size,
      }));
      setStats(processedStats);

      // Fetch daily breakdown (last 7 days)
      const { data: dailyData, error: dailyError } = await supabase
        .from('ai_usage_tracking')
        .select('usage_date, usage_type, usage_count')
        .gte('usage_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('usage_date', { ascending: false });

      if (dailyError) throw dailyError;

      // Process daily data
      const dailyMap: Record<string, DailyUsage> = {};
      (dailyData || []).forEach((row: any) => {
        if (!dailyMap[row.usage_date]) {
          dailyMap[row.usage_date] = {
            usage_date: row.usage_date,
            chat: 0,
            generate_image: 0,
            analyze_image: 0,
            edit_image: 0,
          };
        }
        if (row.usage_type in dailyMap[row.usage_date]) {
          (dailyMap[row.usage_date] as any)[row.usage_type] += row.usage_count;
        }
      });

      setDailyUsage(Object.values(dailyMap).sort((a, b) => 
        new Date(b.usage_date).getTime() - new Date(a.usage_date).getTime()
      ));

    } catch (err) {
      console.error('Error fetching AI usage stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchImageErrorRates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);


  const getIcon = (type: string) => {
    switch (type) {
      case 'chat': return <MessageSquare className="h-6 w-6 text-blue-500" />;
      case 'generate_image': return <ImagePlus className="h-6 w-6 text-purple-500" />;
      case 'analyze_image': return <Eye className="h-6 w-6 text-green-500" />;
      case 'edit_image': return <Paintbrush className="h-6 w-6 text-orange-500" />;
      default: return <MessageSquare className="h-6 w-6" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'chat': return 'Chat AI';
      case 'generate_image': return 'Tạo ảnh';
      case 'analyze_image': return 'Phân tích ảnh';
      case 'edit_image': return 'Chỉnh sửa ảnh';
      default: return type;
    }
  };

  const getCostIndicator = (type: string) => {
    switch (type) {
      case 'chat': return { stars: 1, label: 'Thấp' };
      case 'generate_image': return { stars: 5, label: 'Rất cao' };
      case 'analyze_image': return { stars: 2, label: 'Trung bình' };
      case 'edit_image': return { stars: 6, label: 'Cao nhất' };
      default: return { stars: 1, label: 'N/A' };
    }
  };

  if (!isAdminChecked) {
    return <div className="flex items-center justify-center h-screen">Đang tải...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Thống kê sử dụng AI</h1>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {['chat', 'generate_image', 'analyze_image', 'edit_image'].map(type => {
            const stat = stats.find(s => s.usage_type === type);
            const cost = getCostIndicator(type);
            return (
              <Card key={type}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{getTypeName(type)}</CardTitle>
                  {getIcon(type)}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat?.total_count || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat?.unique_users || 0} người dùng
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Chi phí:</span>
                    <span className="text-xs text-yellow-500">
                      {'⭐'.repeat(cost.stars)}
                    </span>
                    <span className="text-xs text-muted-foreground">({cost.label})</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <AiRoutingLockCard />
        <AiProviderMixCard />
        <CloudFootprintCard />

        {/* Image Generation Error Rates */}

        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImagePlus className="h-5 w-5 text-purple-500" />
              Tỷ lệ lỗi tạo ảnh ({imgErrorDays} ngày)
            </CardTitle>
            <div className="flex gap-2">
              {[1, 7, 30].map(d => (
                <Button
                  key={d}
                  size="sm"
                  variant={imgErrorDays === d ? "default" : "outline"}
                  onClick={() => { setImgErrorDays(d); fetchImageErrorRates(d); }}
                >{d}d</Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {imgErrorRates.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">
                Chưa có sự kiện tạo ảnh nào được ghi lại.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-2">
                  Mã lỗi: <code>ok</code> = thành công · <code>daily_cap</code> = hết lượt/ngày ·{" "}
                  <code>rate_limited</code> = provider bận · <code>moderation</code> = bị bộ lọc chặn ·{" "}
                  <code>upstream_down</code> = provider trục trặc · <code>internal_error</code> = lỗi hệ thống.
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Mã</th>
                      <th className="text-left py-2 px-2">Provider</th>
                      <th className="text-right py-2 px-2">Số lượng</th>
                      <th className="text-right py-2 px-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imgErrorRates.map((r, i) => {
                      const isOk = r.error_code === "ok";
                      const color =
                        isOk ? "text-green-600"
                          : r.error_code === "daily_cap" ? "text-amber-600"
                          : r.error_code === "moderation" ? "text-orange-600"
                          : "text-red-600";
                      return (
                        <tr key={`${r.error_code}-${r.provider}-${i}`} className="border-b">
                          <td className={`py-2 px-2 font-medium ${color}`}>{r.error_code}</td>
                          <td className="py-2 px-2 text-muted-foreground">{r.provider}</td>
                          <td className="text-right py-2 px-2">{r.event_count}</td>
                          <td className="text-right py-2 px-2 font-bold">{r.pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(() => {
                  const total = imgErrorRates.reduce((s, r) => s + r.event_count, 0);
                  const errs = imgErrorRates.filter(r => r.error_code !== "ok")
                    .reduce((s, r) => s + r.event_count, 0);
                  const errRate = total > 0 ? ((errs / total) * 100).toFixed(1) : "0";
                  const warn = Number(errRate) >= 30;
                  return (
                    <div className={`mt-3 p-3 rounded text-xs ${warn ? "bg-red-500/10 text-red-600" : "bg-muted"}`}>
                      Tỷ lệ lỗi tổng: <strong>{errRate}%</strong> ({errs}/{total}).
                      {warn && " ⚠ Cân nhắc nâng cấp gói provider hoặc bổ sung fallback."}
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Breakdown */}
        <Card>

          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Thống kê theo ngày (7 ngày gần nhất)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyUsage.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Ngày</th>
                      <th className="text-center py-2 px-4">Chat</th>
                      <th className="text-center py-2 px-4">Tạo ảnh</th>
                      <th className="text-center py-2 px-4">Phân tích</th>
                      <th className="text-center py-2 px-4">Chỉnh sửa</th>
                      <th className="text-center py-2 px-4">Tổng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyUsage.map(day => (
                      <tr key={day.usage_date} className="border-b">
                        <td className="py-2 px-4">
                          {format(new Date(day.usage_date), 'dd/MM/yyyy', { locale: vi })}
                        </td>
                        <td className="text-center py-2 px-4">{day.chat}</td>
                        <td className="text-center py-2 px-4 text-purple-500 font-medium">
                          {day.generate_image}
                        </td>
                        <td className="text-center py-2 px-4">{day.analyze_image}</td>
                        <td className="text-center py-2 px-4 text-orange-500 font-medium">
                          {day.edit_image}
                        </td>
                        <td className="text-center py-2 px-4 font-bold">
                          {day.chat + day.generate_image + day.analyze_image + day.edit_image}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost Estimation */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Ước tính chi phí tương đối</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <div className="font-medium text-blue-500">Chat AI</div>
                <div className="text-muted-foreground">1x (chuẩn)</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <div className="font-medium text-green-500">Phân tích ảnh</div>
                <div className="text-muted-foreground">2-3x</div>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <div className="font-medium text-purple-500">Tạo ảnh</div>
                <div className="text-muted-foreground">10-20x</div>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <div className="font-medium text-orange-500">Chỉnh sửa ảnh</div>
                <div className="text-muted-foreground">15-25x</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              * Giới hạn hiện tại: Tạo ảnh & Chỉnh sửa ảnh: 5 lần/ngày/người dùng
            </p>
          </CardContent>
        </Card>


        {/* Cache Management (Phase 3) */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Quản lý cache câu trả lời
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Tìm và xoá các câu trả lời đã cache trong bảng <code>cached_responses</code>. Dùng khi bot trả lời sai/trùng lặp cho các câu khác nhau.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Tìm theo từ khoá trong câu hỏi (vd: tình yêu)"
                value={cacheSearch}
                onChange={(e) => setCacheSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCache()}
              />
              <Button onClick={searchCache} disabled={cacheBusy}>
                <Search className="h-4 w-4 mr-2" />Tìm
              </Button>
            </div>
            {cacheHits.length > 0 && (
              <div className="border rounded-lg divide-y max-h-96 overflow-auto">
                {cacheHits.map((row) => (
                  <div key={row.question_normalized} className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{row.question_normalized}</div>
                      <div className="text-xs text-muted-foreground">
                        Hit: {row.hit_count} · {row.last_used_at ? format(new Date(row.last_used_at), 'dd/MM HH:mm', { locale: vi }) : '—'}
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteCache(row.question_normalized)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />Xoá
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {cacheSearch && !cacheBusy && cacheHits.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Không có cache khớp.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
