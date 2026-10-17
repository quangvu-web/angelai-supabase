import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Server } from "lucide-react";

interface Job {
  jobname: string;
  schedule: string;
  runs_per_day: number;
}
interface Tbl {
  table: string;
  bytes: number;
  pretty: string;
}
interface Footprint {
  jobs: Job[];
  tables: Tbl[];
  db_size_pretty: string;
}

export function CloudFootprintCard() {
  const q = useQuery({
    queryKey: ["cloud-footprint"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cloud_footprint" as any);
      if (error) throw error;
      return data as unknown as Footprint;
    },
    refetchInterval: 300_000,
  });

  const jobs = (q.data?.jobs ?? []).slice().sort((a, b) => b.runs_per_day - a.runs_per_day);
  const totalRuns = jobs.reduce((s, j) => s + Number(j.runs_per_day || 0), 0);

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="h-4 w-4 text-primary" />
          Dấu chân hạ tầng
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? (
          <Skeleton className="h-40" />
        ) : q.error ? (
          <p className="text-sm text-muted-foreground">
            Không đọc được dữ liệu ({String((q.error as any)?.message ?? "")}).
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="secondary">{jobs.length} tác vụ nền đang bật</Badge>
              <Badge variant="secondary">~{totalRuns.toLocaleString("vi-VN")} lượt chạy/ngày</Badge>
              <Badge variant="secondary">Dung lượng DB: {q.data?.db_size_pretty}</Badge>
            </div>

            <div>
              <p className="text-xs font-medium mb-1">Tác vụ chạy dày nhất</p>
              <div className="space-y-1">
                {jobs.slice(0, 6).map((j) => (
                  <div key={j.jobname} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{j.jobname}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {j.schedule} · ~{j.runs_per_day}/ngày
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-1">Bảng chiếm dung lượng lớn nhất</p>
              <div className="space-y-1">
                {(q.data?.tables ?? []).slice(0, 6).map((t) => (
                  <div key={t.table} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{t.table}</span>
                    <span className="text-muted-foreground tabular-nums">{t.pretty}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Chi phí máy chủ tính theo giờ chạy, không theo số câu truy vấn. Tác vụ nền chạy càng dày thì máy càng
              khó nghỉ. Nhật ký kỹ thuật cũ hơn 90 ngày được dọn tự động mỗi Chủ nhật.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
