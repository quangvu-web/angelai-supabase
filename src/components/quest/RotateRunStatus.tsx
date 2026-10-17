import { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, User, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface RotateRun {
  id: string;
  user_id: string | null;
  mode: "single" | "cron";
  assigned_count: number;
  users_count: number;
  success: boolean;
  error_text: string | null;
  created_at: string;
}

interface Props {
  refreshKey?: number;
}

export default function RotateRunStatus({ refreshKey }: Props) {
  const { user } = useAuth();
  const [mine, setMine] = useState<RotateRun | null>(null);
  const [cron, setCron] = useState<RotateRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const [mineRes, cronRes] = await Promise.all([
        supabase
          .from("quest_rotate_runs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("quest_rotate_runs")
          .select("*")
          .is("user_id", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!mounted) return;
      setMine((mineRes.data as RotateRun) ?? null);
      setCron((cronRes.data as RotateRun) ?? null);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [user, refreshKey]);

  if (loading || (!mine && !cron)) return null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });

  const Row = ({ run, label, icon: Icon }: { run: RotateRun; label: string; icon: typeof User }) => (
    <div className="flex items-start gap-3 py-2">
      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium">{label}</span>
          <Badge variant={run.mode === "single" ? "secondary" : "outline"} className="text-[10px]">
            {run.mode}
          </Badge>
          {run.success ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-destructive" />
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="h-3 w-3" /> {fmt(run.created_at)}
        </div>
        <div className="text-xs mt-1">
          <span className="font-semibold text-primary">{run.assigned_count}</span> quest
          {run.mode === "cron" && (
            <span className="text-muted-foreground"> • {run.users_count} user</span>
          )}
          {run.error_text && (
            <span className="text-destructive ml-2 line-clamp-1">⚠ {run.error_text}</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Card className="p-3">
      <div className="text-xs font-semibold text-muted-foreground mb-1">
        Lần chạy gần nhất — quest-daily-rotate
      </div>
      {mine && <Row run={mine} label="Của bạn" icon={User} />}
      {cron && <Row run={cron} label="Cron toàn hệ thống" icon={Globe} />}
    </Card>
  );
}
