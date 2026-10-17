import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";

interface Row {
  provider: string;
  calls: number;
  pct: number;
}

const LABELS: Record<string, string> = {
  cloudflare: "Cloudflare BYOK (Google key)",
  google_direct: "Google API trực tiếp",
  lovable: "Lovable Gateway (tốn credit)",
  unknown: "Không xác định",
};

export function AiProviderMixCard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_ai_provider_mix", { _days: 7 });
      if (error) throw error;
      setRows(
        ((data as any[]) ?? []).map((r) => ({
          provider: r.provider,
          calls: Number(r.calls),
          pct: Number(r.pct),
        })),
      );
    } catch (e) {
      console.error("provider mix error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const lovableCalls = rows.find((r) => r.provider === "lovable")?.calls ?? 0;

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          {lovableCalls > 0 ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-primary" />
          )}
          Nguồn AI 7 ngày qua
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu định tuyến.</p>
        )}
        {rows.map((r) => (
          <div key={r.provider} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {LABELS[r.provider] ?? r.provider}
              {r.provider === "lovable" && <Badge variant="destructive">tốn credit</Badge>}
            </span>
            <span className="font-medium tabular-nums">
              {r.calls} lượt · {r.pct}%
            </span>
          </div>
        ))}
        {lovableCalls > 0 ? (
          <p className="text-xs text-destructive">
            Có {lovableCalls} lượt chạm Lovable Gateway. Kiểm tra lại cờ ALLOW_LOVABLE_FALLBACK và tình trạng nguồn Google.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Toàn bộ lượt chat đang chạy bằng nguồn Google của dự án — không tốn credit Lovable.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
