import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Pencil, History, Search, Settings2 } from "lucide-react";
import { format } from "date-fns";

type ActionCap = {
  id: string;
  action_type: string;
  platform_id: string;
  base_reward: number;
  thresholds: Record<string, number>;
  is_active: boolean;
  updated_at: string;
};

type AuditRow = {
  id: string;
  action_type: string;
  platform_id: string;
  environment: string;
  old_thresholds: Record<string, number> | null;
  new_thresholds: Record<string, number>;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
};

const PILLAR_KEYS = ["LightScore", "T", "S", "H", "C", "U"] as const;

export default function AdminThresholds() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [editingCap, setEditingCap] = useState<ActionCap | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [environment, setEnvironment] = useState<string>("production");

  // Fetch action caps
  const { data: caps = [], isLoading } = useQuery({
    queryKey: ["admin-action-caps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pplp_action_caps")
        .select("id, action_type, platform_id, base_reward, thresholds, is_active, updated_at")
        .order("action_type");
      if (error) throw error;
      return (data || []) as ActionCap[];
    },
  });

  // Fetch audit log
  const { data: audit = [] } = useQuery({
    queryKey: ["admin-threshold-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_threshold_audit", { _limit: 200 });
      if (error) throw error;
      return (data || []) as AuditRow[];
    },
    refetchInterval: 30_000,
  });

  const platforms = useMemo(() => {
    const set = new Set<string>(caps.map((c) => c.platform_id));
    return Array.from(set).sort();
  }, [caps]);

  const filteredCaps = useMemo(() => {
    return caps.filter((c) => {
      const matchSearch =
        !search ||
        c.action_type.toLowerCase().includes(search.toLowerCase()) ||
        c.platform_id.toLowerCase().includes(search.toLowerCase());
      const matchPlatform = platformFilter === "all" || c.platform_id === platformFilter;
      return matchSearch && matchPlatform;
    });
  }, [caps, search, platformFilter]);

  const updateMutation = useMutation({
    mutationFn: async (params: {
      action_type: string;
      platform_id: string;
      new_thresholds: Record<string, number>;
      reason: string;
      environment: string;
    }) => {
      const { data, error } = await supabase.rpc("admin_update_action_thresholds", {
        _action_type: params.action_type,
        _platform_id: params.platform_id,
        _new_thresholds: params.new_thresholds,
        _reason: params.reason || null,
        _environment: params.environment,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật ngưỡng & ghi audit log");
      qc.invalidateQueries({ queryKey: ["admin-action-caps"] });
      qc.invalidateQueries({ queryKey: ["admin-threshold-audit"] });
      setEditingCap(null);
      setReason("");
    },
    onError: (e: any) => toast.error(e?.message || "Lỗi cập nhật"),
  });

  const openEdit = (cap: ActionCap) => {
    setEditingCap(cap);
    const initial: Record<string, string> = {};
    PILLAR_KEYS.forEach((k) => {
      const v = cap.thresholds?.[k];
      if (v !== undefined && v !== null) initial[k] = String(v);
    });
    setEditValues(initial);
    setReason("");
  };

  const handleSave = () => {
    if (!editingCap) return;
    const newThresholds: Record<string, number> = {};
    for (const [k, v] of Object.entries(editValues)) {
      if (v === "" || v === null) continue;
      const n = Number(v);
      if (!isFinite(n) || n < 0 || n > 100) {
        toast.error(`Giá trị ${k} không hợp lệ (0-100)`);
        return;
      }
      newThresholds[k] = n;
    }
    if (Object.keys(newThresholds).length === 0) {
      toast.error("Cần ít nhất 1 ngưỡng");
      return;
    }
    updateMutation.mutate({
      action_type: editingCap.action_type,
      platform_id: editingCap.platform_id,
      new_thresholds: newThresholds,
      reason,
      environment,
    });
  };

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Settings2 className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Quản lý Threshold PLP</h1>
            <p className="text-sm text-muted-foreground">
              Chỉnh ngưỡng T / LightScore / S / H / C / U động — không cần deploy lại edge function
            </p>
          </div>
        </div>

        <Tabs defaultValue="caps" className="space-y-4">
          <TabsList>
            <TabsTrigger value="caps">
              <Settings2 className="w-4 h-4 mr-2" /> Cấu hình ngưỡng
            </TabsTrigger>
            <TabsTrigger value="audit">
              <History className="w-4 h-4 mr-2" /> Lịch sử thay đổi
            </TabsTrigger>
          </TabsList>

          <TabsContent value="caps" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bộ lọc</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Tìm action_type / platform..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả platform</SelectItem>
                    {platforms.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Base Reward</TableHead>
                      <TableHead>Thresholds</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Sửa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          Đang tải...
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && filteredCaps.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          Không có dữ liệu
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredCaps.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.action_type}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{c.platform_id}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{c.base_reward}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(c.thresholds || {}).map(([k, v]) => (
                              <Badge key={k} variant="outline" className="text-xs font-mono">
                                {k}: {String(v)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(c.updated_at), "dd/MM HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lịch sử thay đổi (200 mới nhất)</CardTitle>
                <CardDescription>Mọi cập nhật ngưỡng đều được log vĩnh viễn</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Action / Platform</TableHead>
                      <TableHead>Env</TableHead>
                      <TableHead>Cũ → Mới</TableHead>
                      <TableHead>Lý do</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Chưa có thay đổi nào
                        </TableCell>
                      </TableRow>
                    )}
                    {audit.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(a.changed_at), "dd/MM/yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">{a.action_type}</div>
                          <Badge variant="secondary" className="text-xs mt-1">{a.platform_id}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.environment === "production" ? "default" : "outline"}>
                            {a.environment}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="text-muted-foreground line-through">
                            {JSON.stringify(a.old_thresholds)}
                          </div>
                          <div className="text-foreground font-medium">
                            {JSON.stringify(a.new_thresholds)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                          {a.reason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit dialog */}
        <Dialog open={!!editingCap} onOpenChange={(o) => !o && setEditingCap(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Chỉnh ngưỡng: <span className="font-mono">{editingCap?.action_type}</span>
              </DialogTitle>
              <CardDescription>
                Platform: <Badge variant="secondary">{editingCap?.platform_id}</Badge>
              </CardDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Môi trường</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PILLAR_KEYS.map((k) => (
                  <div key={k}>
                    <Label className="text-xs">{k}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      placeholder="bỏ trống = không dùng"
                      value={editValues[k] ?? ""}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [k]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div>
                <Label>Lý do thay đổi (audit)</Label>
                <Textarea
                  placeholder="VD: Hạ ngưỡng T xuống 30 để đa số bài viết thực sự pass Truth Gate..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditingCap(null)}>
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Đang lưu..." : "Lưu & ghi audit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
