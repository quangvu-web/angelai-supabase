import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Calculator, FileCode, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { smartBack } from "@/lib/smartBack";

const AntiWhaleCap = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Quy tắc Anti-Whale Cap 3% — FUN Money Mint | FUN SuperApp";
    const desc = "Tài liệu chính thức về quy tắc max_share_per_user 3% và cách áp dụng vào userRewardPool trong các cycle mint FUN Money.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", "https://angel999.lovable.app/docs/anti-whale-cap");
  }, []);

  return (
    <div className="min-h-screen bg-background pb-12">

      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => smartBack(navigate)}
            aria-label="Quay lại"
            className="min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-bold">Anti-Whale Cap 3%</h1>
            <p className="text-xs text-muted-foreground">FUN Money Mint Governance Rule</p>
          </div>
          <Badge variant="outline" className="hidden sm:flex">v1.0</Badge>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-r from-[#b8860b] via-[#daa520] via-[#ffd700] to-[#ffec8b] p-6 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <Shield className="h-8 w-8 !text-black flex-shrink-0" strokeWidth={2.5} />
            <div>
              <h2 className="!text-black text-2xl font-extrabold leading-tight">
                Quy tắc Anti-Whale Cap 3%
              </h2>
              <p className="!text-black/80 mt-1 text-sm font-semibold">
                Giới hạn 3% userRewardPool mỗi user mỗi cycle để bảo vệ phân bổ công bằng và chống tập trung token.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Section 1: Rule Statement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </span>
              Phát biểu quy tắc
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Trong mỗi <strong>cycle mint</strong> FUN Money (monthly hoặc epoch),
              không một địa chỉ ví nào được nhận quá <strong>3% của userRewardPool</strong> —
              bất kể Light Contribution Score (TLS) của họ có cao đến đâu.
            </p>
            <div className="rounded-lg bg-muted/50 border p-3 font-mono text-xs">
              <code>per_user_max_ratio = 0.03 (3%)</code>
              <br />
              <code>cap_amount = userRewardPool × 0.03</code>
            </div>
            <p className="text-muted-foreground">
              Quy tắc này là <em>single source of truth</em> được khoá cứng trong
              code và đã đi qua governance review.
            </p>
          </CardContent>
        </Card>

        {/* Section 2: Allocation Buckets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </span>
              Phân bổ pool theo 5 bucket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>total_mint_pool</strong> của mỗi cycle được chia thành 5 bucket
              theo Adaptive Mint Engine v1:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left font-semibold">Bucket</th>
                    <th className="p-2 text-right font-semibold">Tỷ lệ</th>
                    <th className="p-2 text-left font-semibold">Mục đích</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-primary/5">
                    <td className="p-2 font-semibold">user_reward</td>
                    <td className="p-2 text-right font-mono">70%</td>
                    <td className="p-2">Phân bổ cho user theo TLS contribution</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">ecosystem</td>
                    <td className="p-2 text-right font-mono">12%</td>
                    <td className="p-2">Quỹ phát triển hệ sinh thái</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">treasury</td>
                    <td className="p-2 text-right font-mono">10%</td>
                    <td className="p-2">Treasury vault dài hạn</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">strategic_growth</td>
                    <td className="p-2 text-right font-mono">5%</td>
                    <td className="p-2">Đối tác chiến lược, marketing</td>
                  </tr>
                  <tr>
                    <td className="p-2">resilience_reserve</td>
                    <td className="p-2 text-right font-mono">3%</td>
                    <td className="p-2">Quỹ dự phòng rủi ro</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3 text-xs">
              <strong>Quan trọng:</strong> Cap 3% áp lên <strong>userRewardPool (70% pool)</strong>,
              KHÔNG áp lên <strong>total_mint_pool</strong>.
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Worked Example */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Ví dụ minh hoạ — Cycle tháng 4/2026
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between border-b py-1">
                <span>total_mint_pool</span>
                <strong>50,000,000 FUN</strong>
              </div>
              <div className="flex justify-between border-b py-1 pl-4 text-muted-foreground">
                <span>× user_reward (70%)</span>
                <span>= 35,000,000 FUN</span>
              </div>
              <div className="flex justify-between border-b py-1 pl-4">
                <span>userRewardPool</span>
                <strong>35,000,000 FUN</strong>
              </div>
              <div className="flex justify-between border-b py-1 pl-4 text-muted-foreground">
                <span>× per_user_max_ratio (3%)</span>
                <span>= 1,050,000 FUN</span>
              </div>
              <div className="flex justify-between bg-primary/10 py-2 px-2 rounded">
                <span className="font-semibold">Cap mỗi user</span>
                <strong className="text-primary">1,050,000 FUN</strong>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
              <p><strong>4 bucket còn lại (30% × 50M = 15M FUN):</strong></p>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Ecosystem: 6,000,000 FUN</li>
                <li>Treasury: 5,000,000 FUN</li>
                <li>Strategic Growth: 2,500,000 FUN</li>
                <li>Resilience Reserve: 1,500,000 FUN</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Algorithm */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              Thuật toán áp dụng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Hàm <code className="bg-muted px-1.5 py-0.5 rounded text-xs">applyAntiWhaleCap()</code> chạy theo các bước:</p>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>
                <strong>Tính cap_amount</strong> = userRewardPool × 0.03
              </li>
              <li>
                <strong>Tính raw_share</strong> mỗi user = TLS<sub>user</sub> / Σ TLS × userRewardPool
              </li>
              <li>
                <strong>Áp cap</strong>: nếu raw_share &gt; cap_amount → user nhận đúng cap_amount, phần dư
                <em> overflow</em> = raw_share − cap_amount đẩy vào pool rollover
              </li>
              <li>
                <strong>Tái phân bổ</strong> overflow cho các user chưa chạm cap, theo tỷ lệ TLS
              </li>
              <li>
                <strong>Lặp lại</strong> tới khi không còn overflow hoặc tất cả user đều chạm cap;
                phần dư cuối cùng trả về <em>resilience_reserve</em>
              </li>
            </ol>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="font-semibold mb-1">File code (single source of truth):</p>
              <ul className="space-y-0.5 font-mono text-xs">
                <li><code>supabase/functions/pplp-epoch-allocate/index.ts:14</code> — <code>ANTI_WHALE_CAP = 0.03</code></li>
                <li><code>supabase/functions/pplp-epoch-allocate/index.ts:23</code> — <code>per_user_max_ratio: 0.03</code></li>
                <li><code>supabase/functions/process-mint-cycle/index.ts:10</code> — <code>DEFAULT_MAX_SHARE = 0.03</code></li>
                <li><code>supabase/functions/pplp-epoch-reset/index.ts:123</code> — seed cycle mới</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Why */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Tại sao chọn 3%?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Đảm bảo &ge; 34 user phân bổ pool</strong>: với cap 3%, một mình một user
                chỉ chiếm tối đa 3% userRewardPool, buộc pool phải chia cho tối thiểu ~34 ví khác
                nhau trước khi rollover.
              </li>
              <li>
                <strong>Chống Sybil farming</strong>: kết hợp với Identity SBT/DIB và Trust Engine
                (T0–T4), cap 3% triệt tiêu lợi ích kinh tế của việc tạo nhiều ví giả để vượt cap.
              </li>
              <li>
                <strong>Phân bổ công bằng</strong>: phù hợp nguyên tắc "No competitive
                leaderboards" — không một user nào được áp đảo cycle, kể cả khi TLS rất cao.
              </li>
              <li>
                <strong>Có nền tảng học thuật</strong>: 3% nằm trong khoảng quy tắc Pareto-aware
                cho token distribution của các giao thức DeFi nghiêm túc (Optimism, Gitcoin).
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 6: Override */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Quy tắc override
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Cap 3% là <strong>governance constant</strong>. Không thể thay đổi qua admin
              UI hay UPDATE trực tiếp DB. Để thay đổi cần:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Đề xuất qua FUN Charter governance ledger với reason code <code className="text-xs bg-muted px-1 rounded">CAP_RESIZE</code></li>
              <li>Timelock 48h theo Transparency Ledger v1</li>
              <li>Sign-off 3-of-3 multisig (will / wisdom / love)</li>
              <li>Cập nhật cả 4 file code và deploy edge functions cùng lúc</li>
            </ol>
          </CardContent>
        </Card>

        {/* References */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tham chiếu</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>• <strong>Memory:</strong> Epoch Architecture (3% whale cap, single source of truth)</p>
            <p>• <strong>Memory:</strong> Adaptive Mint Engine v1 (allocation buckets 70/12/10/5/3)</p>
            <p>• <strong>Memory:</strong> Transparency Ledger v1 (timelock 48h, reason codes)</p>
            <p>• <strong>DB:</strong> <code>pplp_mint_cycles.max_share_per_user</code> (default 0.03)</p>
            <p className="pt-2 italic">Phiên bản tài liệu: v1.0 · Cập nhật cho cycle tháng 4/2026 (pool 50M FUN)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AntiWhaleCap;
