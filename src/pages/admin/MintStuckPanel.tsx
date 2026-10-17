import { useState } from "react";
import { smartBack } from "@/lib/smartBack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Bell, RefreshCw, XCircle, Clock, ArrowLeft, Loader2, CheckCircle2, Shield } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface StuckRequest {
  id: string;
  actor_id: string;
  recipient_address: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  multisig_completed_groups: string[] | null;
  multisig_signatures: Record<string, { signer_address?: string; signer_name?: string; signed_at?: string }> | null;
}

const REQUIRED_GROUPS = ["will", "wisdom", "love"] as const;
const GROUP_META: Record<string, { label: string; emoji: string }> = {
  will: { label: "Ý Chí", emoji: "🔥" },
  wisdom: { label: "Trí Tuệ", emoji: "📘" },
  love: { label: "Tình Yêu", emoji: "💖" },
};

function SigningProgress({ request }: { request: StuckRequest }) {
  const completed = request.multisig_completed_groups || [];
  const sigs = request.multisig_signatures || {};
  const count = REQUIRED_GROUPS.filter((g) => completed.includes(g)).length;
  const pct = (count / REQUIRED_GROUPS.length) * 100;
  const isFullySigned = count >= REQUIRED_GROUPS.length;

  return (
    <TooltipProvider>
      <div className="space-y-1.5 min-w-[140px]">
        <div className="flex items-center gap-1.5">
          {isFullySigned ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
          ) : (
            <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <span className={`text-xs font-semibold ${isFullySigned ? "text-green-500" : ""}`}>
            {count}/{REQUIRED_GROUPS.length} chữ ký
          </span>
        </div>
        <Progress value={pct} className="h-1.5" />
        <div className="flex gap-1">
          {REQUIRED_GROUPS.map((g) => {
            const signed = completed.includes(g);
            const sig = sigs[g];
            const meta = GROUP_META[g];
            return (
              <Tooltip key={g}>
                <TooltipTrigger asChild>
                  <Badge
                    variant={signed ? "default" : "outline"}
                    className={`text-[10px] cursor-default ${
                      signed ? "bg-green-600 hover:bg-green-600 text-white" : "opacity-50"
                    }`}
                  >
                    {meta.emoji} {g[0].toUpperCase()}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <p className="font-semibold">{meta.emoji} {meta.label}</p>
                  {signed && sig ? (
                    <>
                      <p>✅ {sig.signer_name || sig.signer_address?.slice(0, 10)}</p>
                      {sig.signed_at && (
                        <p className="text-muted-foreground">
                          {format(new Date(sig.signed_at), "HH:mm dd/MM/yyyy")}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">⏳ Chưa ký</p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default function MintStuckPanel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; request?: StuckRequest }>({ open: false });
  const [reason, setReason] = useState("");

  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ["stuck-mint-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pplp_mint_requests")
        .select("id, actor_id, recipient_address, amount, status, created_at, updated_at, multisig_completed_groups, multisig_signatures")
        .in("status", ["pending_sig", "signing"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as StuckRequest[];
    },
    refetchInterval: 30_000,
  });

  const nudgeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.rpc("notify_attesters", { p_request_id: requestId });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      toast.success(`Đã gửi nhắc đến ${data?.notified_count ?? 0} Attester`);
      qc.invalidateQueries({ queryKey: ["stuck-mint-requests"] });
    },
    onError: (e: any) => toast.error(`Lỗi: ${e.message}`),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("cancel_mint_request_safe", {
        p_request_id: requestId,
        p_reason: reason || "Admin cancelled stuck request",
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      toast.success(`Đã hủy & hoàn ${data?.amount_refunded?.toLocaleString()} FUN cho user claim lại`);
      setCancelDialog({ open: false });
      setReason("");
      qc.invalidateQueries({ queryKey: ["stuck-mint-requests"] });
    },
    onError: (e: any) => toast.error(`Lỗi: ${e.message}`),
  });

  const totalStuck = (requests || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const oldestAgeDays = requests?.[0]
    ? Math.floor((Date.now() - new Date(requests[0].created_at).getTime()) / 86400000)
    : 0;

  const getAgeDays = (createdAt: string) =>
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
        </Button>
        <h1 className="text-2xl font-bold">🔧 Mint Stuck Panel</h1>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Đang kẹt</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{requests?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">Tổng FUN kẹt</span>
            </div>
            <p className="text-xl font-bold text-amber-500">{totalStuck.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Cũ nhất</span>
            </div>
            <p className="text-xl font-bold">{oldestAgeDays} ngày</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-center">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Làm mới
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách request đang kẹt (status = pending_sig)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
          ) : (requests?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">✅ Không có request nào đang kẹt</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tuổi</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Đã ký</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests!.map((r) => {
                    const ageDays = getAgeDays(r.created_at);
                    const canForceExpire = ageDays >= 14;
                    
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <Badge variant={ageDays > 7 ? "destructive" : ageDays > 2 ? "default" : "secondary"}>
                              {ageDays}d
                            </Badge>
                            <span className="text-[10px] text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: vi })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.recipient_address.slice(0, 6)}...{r.recipient_address.slice(-4)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-500">
                          {Number(r.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <SigningProgress request={r} />
                        </TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => nudgeMutation.mutate(r.id)}
                            disabled={nudgeMutation.isPending}
                          >
                            {nudgeMutation.isPending && nudgeMutation.variables === r.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Bell className="w-3 h-3" />
                            )}
                            <span className="ml-1 hidden sm:inline">Nudge</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setCancelDialog({ open: true, request: r })}
                          >
                            <XCircle className="w-3 h-3" />
                            <span className="ml-1 hidden sm:inline">Cancel</span>
                          </Button>
                          {canForceExpire && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                cancelMutation.mutate({
                                  requestId: r.id,
                                  reason: `Force expire after ${ageDays} days`,
                                })
                              }
                            >
                              <Clock className="w-3 h-3" />
                              <span className="ml-1 hidden sm:inline">Expire</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(o) => !o && setCancelDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy & Hoàn FUN để claim lại</DialogTitle>
            <DialogDescription>
              Hành động này sẽ hủy mint request, đưa allocation về trạng thái pending để user có thể claim lại từ
              đầu. Không có FUN nào bị mất (request chưa mint on-chain).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm bg-muted/50 p-3 rounded">
              <div>
                Recipient: <span className="font-mono">{cancelDialog.request?.recipient_address}</span>
              </div>
              <div>
                Amount:{" "}
                <span className="font-bold text-amber-500">
                  {Number(cancelDialog.request?.amount || 0).toLocaleString()} FUN
                </span>
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Lý do</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Attesters offline > 7 ngày, cho user claim lại"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog({ open: false })}>
              Hủy bỏ
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                cancelDialog.request &&
                cancelMutation.mutate({ requestId: cancelDialog.request.id, reason })
              }
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Xác nhận hủy & hoàn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
