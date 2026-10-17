import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lock, Unlock } from "lucide-react";

export function AiRoutingLockCard() {
  const [locked, setLocked] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "ai_routing")
      .maybeSingle();
    if (!error) {
      const v = (data?.value as any)?.lock_google_only;
      setLocked(typeof v === "boolean" ? v : true);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("system_settings")
      .upsert(
        {
          key: "ai_routing",
          value: { lock_google_only: next },
          description:
            "Khóa luồng AI: chỉ dùng Cloudflare BYOK → Google API trực tiếp, chặn fallback Lovable Gateway",
        },
        { onConflict: "key" },
      );
    setSaving(false);
    if (error) {
      toast.error("Không lưu được cấu hình: " + error.message);
      return;
    }
    setLocked(next);
    toast.success(
      next
        ? "Đã khóa: chỉ dùng Cloudflare → Google, chặn Lovable Gateway"
        : "Đã mở khóa: cho phép fallback Lovable Gateway (tốn credit)",
    );
  };

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          {locked ? (
            <Lock className="h-4 w-4 text-primary" />
          ) : (
            <Unlock className="h-4 w-4 text-destructive" />
          )}
          Khóa luồng AI
          <Badge variant={locked ? "secondary" : "destructive"}>
            {locked ? "Chỉ Google" : "Cho phép Lovable"}
          </Badge>
        </CardTitle>
        <Switch checked={locked} disabled={loading || saving} onCheckedChange={toggle} />
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Khi bật, hệ thống chỉ dùng Cloudflare BYOK → Google API trực tiếp và tự động chặn mọi
          fallback sang Lovable Gateway. Nếu cả hai nguồn Google đều bận, người dùng nhận thông báo
          thử lại thay vì tiêu credit. Thay đổi có hiệu lực trong vòng 30 giây.
        </p>
      </CardContent>
    </Card>
  );
}
