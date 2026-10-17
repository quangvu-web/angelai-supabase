import { useState } from "react";
import { smartBack } from "@/lib/smartBack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Pencil, Trash2, Send, Eye, History } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface Template {
  id: string;
  name: string;
  cycle_type: string;
  notification_type: string;
  title: string;
  content_template: string;
  cta_label: string;
  cta_url: string;
  audience: string;
  is_active: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface MintCycle {
  id: string;
  cycle_number: number;
  cycle_type: string;
  start_date: string;
  status: string;
}

const AUDIENCES = [
  { value: "cycle_eligible", label: "Người đủ điều kiện trong cycle" },
  { value: "cycle_unclaimed", label: "Người chưa claim trong cycle" },
  { value: "all_users", label: "Tất cả user" },
];

const CYCLE_TYPES = [
  { value: "weekly", label: "Hàng tuần" },
  { value: "monthly", label: "Hàng tháng" },
  { value: "custom", label: "Tuỳ chỉnh" },
];

const emptyForm: Partial<Template> = {
  name: "",
  cycle_type: "monthly",
  notification_type: "mint_ready",
  title: "",
  content_template: "",
  cta_label: "Claim ngay",
  cta_url: "/mint",
  audience: "cycle_eligible",
  is_active: true,
};

export default function NotificationTemplates() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editor, setEditor] = useState<{ open: boolean; data: Partial<Template> }>({
    open: false, data: emptyForm,
  });
  const [sender, setSender] = useState<{ open: boolean; tpl?: Template }>({ open: false });
  const [sendOpts, setSendOpts] = useState<{ cycle_id: string; cycle_label: string; audience: string }>({
    cycle_id: "", cycle_label: "", audience: "",
  });
  const [preview, setPreview] = useState<any>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notification_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["mint-cycles-recent-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pplp_mint_cycles").select("id, cycle_number, cycle_type, start_date, status")
        .order("cycle_number", { ascending: false }).limit(10);
      if (error) throw error;
      return data as MintCycle[];
    },
  });

  const { data: broadcasts = [] } = useQuery({
    queryKey: ["notification-broadcasts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notification_broadcasts")
        .select("id, template_id, cycle_label, audience, recipients_count, sent_count, skipped_count, status, created_at")
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (data: Partial<Template>) => {
      if (data.id) {
        const { error } = await (supabase as any)
          .from("notification_templates").update(data).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("notification_templates").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Đã lưu mẫu thông báo");
      setEditor({ open: false, data: emptyForm });
      qc.invalidateQueries({ queryKey: ["notification-templates"] });
    },
    onError: (e: any) => toast.error(e.message || "Lỗi khi lưu"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("notification_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã xoá mẫu");
      qc.invalidateQueries({ queryKey: ["notification-templates"] });
    },
  });

  const broadcast = useMutation({
    mutationFn: async (vars: { template_id: string; dry_run: boolean }) => {
      const { data, error } = await supabase.functions.invoke("send-notification-broadcast", {
        body: {
          template_id: vars.template_id,
          cycle_id: sendOpts.cycle_id || null,
          cycle_label: sendOpts.cycle_label || null,
          audience_override: sendOpts.audience || null,
          dry_run: vars.dry_run,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      if (vars.dry_run) {
        setPreview(data);
      } else {
        toast.success(`Đã gửi ${data.sent} thông báo (bỏ qua ${data.skipped} trùng)`);
        setSender({ open: false });
        setPreview(null);
        qc.invalidateQueries({ queryKey: ["notification-broadcasts"] });
      }
    },
    onError: (e: any) => toast.error(e.message || "Lỗi gửi thông báo"),
  });

  const openSender = (tpl: Template) => {
    setSender({ open: true, tpl });
    const cycle = cycles.find(c => c.cycle_type === tpl.cycle_type) || cycles[0];
    setSendOpts({
      cycle_id: cycle?.id || "",
      cycle_label: cycle ? labelForCycle(cycle) : "",
      audience: tpl.audience,
    });
    setPreview(null);
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => smartBack(navigate)} aria-label="Quay lại">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Mẫu thông báo</h1>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Mẫu</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> Lịch sử gửi</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setEditor({ open: true, data: emptyForm })}>
              <Plus className="h-4 w-4 mr-1" /> Tạo mẫu mới
            </Button>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Đang tải...</p>
          ) : templates.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Chưa có mẫu nào.</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((tpl) => (
                <Card key={tpl.id} className={!tpl.is_active ? "opacity-60" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{tpl.name}</CardTitle>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge variant="secondary">{cycleLabelOf(tpl.cycle_type)}</Badge>
                          <Badge variant="outline">{tpl.notification_type}</Badge>
                          {!tpl.is_active && <Badge variant="destructive">Tắt</Badge>}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="font-medium text-sm">{tpl.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{tpl.content_template}</p>
                    <p className="text-xs text-muted-foreground">
                      CTA: <span className="font-medium">{tpl.cta_label}</span> → {tpl.cta_url}
                    </p>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="default" onClick={() => openSender(tpl)} disabled={!tpl.is_active}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Gửi
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditor({ open: true, data: tpl })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm(`Xoá mẫu "${tpl.name}"?`)) remove.mutate(tpl.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Đối tượng</TableHead>
                    <TableHead>Chu kỳ</TableHead>
                    <TableHead className="text-right">Gửi</TableHead>
                    <TableHead className="text-right">Bỏ qua</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {broadcasts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Chưa có lần gửi nào.</TableCell></TableRow>
                  ) : broadcasts.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-xs">{format(new Date(b.created_at), "dd/MM HH:mm", { locale: vi })}</TableCell>
                      <TableCell>{audienceLabel(b.audience)}</TableCell>
                      <TableCell>{b.cycle_label || "-"}</TableCell>
                      <TableCell className="text-right font-medium">{b.sent_count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{b.skipped_count}</TableCell>
                      <TableCell><Badge variant={b.status === "completed" ? "default" : "destructive"}>{b.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Editor Dialog */}
      <Dialog open={editor.open} onOpenChange={(o) => setEditor({ ...editor, open: o })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor.data.id ? "Sửa mẫu" : "Tạo mẫu mới"}</DialogTitle>
            <DialogDescription>
              Dùng <code className="text-xs bg-muted px-1 rounded">{"{{fun_amount}}"}</code> và{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{cycle_label}}"}</code> để cá nhân hoá nội dung.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tên mẫu</Label>
              <Input value={editor.data.name || ""}
                onChange={(e) => setEditor({ ...editor, data: { ...editor.data, name: e.target.value } })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Chu kỳ</Label>
                <Select value={editor.data.cycle_type}
                  onValueChange={(v) => setEditor({ ...editor, data: { ...editor.data, cycle_type: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CYCLE_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loại thông báo</Label>
                <Input value={editor.data.notification_type || ""}
                  onChange={(e) => setEditor({ ...editor, data: { ...editor.data, notification_type: e.target.value } })} />
              </div>
            </div>
            <div>
              <Label>Tiêu đề</Label>
              <Input value={editor.data.title || ""}
                onChange={(e) => setEditor({ ...editor, data: { ...editor.data, title: e.target.value } })} />
            </div>
            <div>
              <Label>Nội dung</Label>
              <Textarea rows={4} value={editor.data.content_template || ""}
                onChange={(e) => setEditor({ ...editor, data: { ...editor.data, content_template: e.target.value } })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nhãn nút (CTA)</Label>
                <Input value={editor.data.cta_label || ""}
                  onChange={(e) => setEditor({ ...editor, data: { ...editor.data, cta_label: e.target.value } })} />
              </div>
              <div>
                <Label>URL nút</Label>
                <Input value={editor.data.cta_url || ""}
                  onChange={(e) => setEditor({ ...editor, data: { ...editor.data, cta_url: e.target.value } })} />
              </div>
            </div>
            <div>
              <Label>Đối tượng nhận</Label>
              <Select value={editor.data.audience}
                onValueChange={(v) => setEditor({ ...editor, data: { ...editor.data, audience: v } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUDIENCES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editor.data.is_active ?? true}
                onCheckedChange={(c) => setEditor({ ...editor, data: { ...editor.data, is_active: c } })} />
              <Label>Đang bật</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor({ open: false, data: emptyForm })}>Huỷ</Button>
            <Button onClick={() => upsert.mutate(editor.data)} disabled={upsert.isPending}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sender Dialog */}
      <Dialog open={sender.open} onOpenChange={(o) => setSender({ ...sender, open: o })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gửi thông báo: {sender.tpl?.name}</DialogTitle>
            <DialogDescription>Chọn chu kỳ và xem trước trước khi gửi hàng loạt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Chọn cycle (dùng cho dữ liệu cá nhân hoá)</Label>
              <Select value={sendOpts.cycle_id}
                onValueChange={(v) => {
                  const c = cycles.find(x => x.id === v);
                  setSendOpts({ ...sendOpts, cycle_id: v, cycle_label: c ? labelForCycle(c) : "" });
                }}>
                <SelectTrigger><SelectValue placeholder="Chọn cycle..." /></SelectTrigger>
                <SelectContent>
                  {cycles.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      Cycle #{c.cycle_number} — {labelForCycle(c)} ({c.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nhãn chu kỳ hiển thị</Label>
              <Input value={sendOpts.cycle_label}
                onChange={(e) => setSendOpts({ ...sendOpts, cycle_label: e.target.value })}
                placeholder="VD: Tháng 04/2026" />
            </div>
            <div>
              <Label>Đối tượng (ghi đè)</Label>
              <Select value={sendOpts.audience}
                onValueChange={(v) => setSendOpts({ ...sendOpts, audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUDIENCES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {preview && (
              <Card className="bg-muted/40">
                <CardContent className="pt-4 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Sẽ gửi đến <span className="font-bold text-foreground">{preview.recipients_count}</span> người
                  </p>
                  <p className="font-semibold">{preview.sample_title}</p>
                  <p className="text-sm">{preview.sample_content}</p>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => sender.tpl && broadcast.mutate({ template_id: sender.tpl.id, dry_run: true })}
              disabled={broadcast.isPending}>
              <Eye className="h-4 w-4 mr-1" /> Xem trước
            </Button>
            <Button onClick={() => sender.tpl && broadcast.mutate({ template_id: sender.tpl.id, dry_run: false })}
              disabled={broadcast.isPending}>
              <Send className="h-4 w-4 mr-1" /> Gửi ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cycleLabelOf(t: string) {
  return CYCLE_TYPES.find(c => c.value === t)?.label || t;
}
function audienceLabel(a: string) {
  return AUDIENCES.find(x => x.value === a)?.label || a;
}
function labelForCycle(c: MintCycle): string {
  const d = new Date(c.start_date);
  if (c.cycle_type === "monthly") return `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  if (c.cycle_type === "weekly") return `Tuần ${format(d, "dd/MM/yyyy")}`;
  return format(d, "dd/MM/yyyy");
}
