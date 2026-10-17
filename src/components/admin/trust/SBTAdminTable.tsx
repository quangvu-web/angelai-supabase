import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Snowflake, Ban, CalendarClock } from "lucide-react";
import { useAdminSBTList, useSBTAdminMutations } from "@/hooks/useTrustAdmin";

const TYPES = ["", "identity", "trust", "contribution", "credential", "milestone", "legacy"];
const STATUSES = ["", "active", "frozen", "revoked", "archived"];

export function SBTAdminTable() {
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<null | { type: "freeze" | "revoke" | "extend"; token_id: string }>(null);
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState("");

  const { data, isLoading } = useAdminSBTList({ sbt_type: type, status, search });
  const { freeze, revoke, extend } = useSBTAdminMutations();

  const submit = () => {
    if (!action) return;
    if (action.type === "freeze") freeze.mutate({ token_id: action.token_id, reason }, { onSuccess: close });
    else if (action.type === "revoke") revoke.mutate({ token_id: action.token_id, reason }, { onSuccess: close });
    else extend.mutate({ token_id: action.token_id, new_expiry: expiry ? new Date(expiry).toISOString() : null }, { onSuccess: close });
  };
  const close = () => { setAction(null); setReason(""); setExpiry(""); };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quản lý SBT</CardTitle>
        <div className="grid gap-2 md:grid-cols-4 mt-2">
          <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Loại SBT" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả loại</SelectItem>
              {TYPES.filter(Boolean).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Trạng thái" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              {STATUSES.filter(Boolean).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Tìm DID hoặc token_id..." value={search} onChange={(e) => setSearch(e.target.value)} className="md:col-span-2" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-2">Token</th>
                  <th className="px-2">DID</th>
                  <th className="px-2">Type</th>
                  <th className="px-2">Subtype</th>
                  <th className="px-2">Status</th>
                  <th className="px-2">Weight</th>
                  <th className="px-2">Expires</th>
                  <th className="px-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {(data as any[] || []).map((s) => (
                  <tr key={s.token_id} className="border-b hover:bg-muted/40">
                    <td className="py-2 pr-2 font-mono text-xs truncate max-w-[120px]" title={s.token_id}>{s.token_id}</td>
                    <td className="px-2 font-mono text-xs truncate max-w-[160px]" title={s.did}>{s.did}</td>
                    <td className="px-2 text-xs">{s.sbt_type}</td>
                    <td className="px-2 text-xs">{s.sbt_subtype}</td>
                    <td className="px-2 text-xs">
                      <span className={
                        s.status === "active" ? "text-primary" :
                        s.status === "frozen" ? "text-amber-500" :
                        s.status === "revoked" ? "text-destructive" : "text-muted-foreground"
                      }>{s.status}</span>
                    </td>
                    <td className="px-2 font-mono text-xs">{Number(s.trust_weight).toFixed(2)}</td>
                    <td className="px-2 text-xs whitespace-nowrap">{s.expires_at ? new Date(s.expires_at).toLocaleDateString("vi-VN") : "—"}</td>
                    <td className="px-2 flex gap-1">
                      <Button size="sm" variant="ghost" disabled={s.status !== "active"} onClick={() => setAction({ type: "freeze", token_id: s.token_id })} title="Đóng băng">
                        <Snowflake className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" disabled={s.status === "revoked"} onClick={() => setAction({ type: "revoke", token_id: s.token_id })} title="Thu hồi">
                        <Ban className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAction({ type: "extend", token_id: s.token_id })} title="Gia hạn">
                        <CalendarClock className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {(data as any[] || []).length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Không có SBT nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!action} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.type === "freeze" && "Đóng băng SBT"}
              {action?.type === "revoke" && "Thu hồi SBT"}
              {action?.type === "extend" && "Gia hạn SBT"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-mono break-all">{action?.token_id}</p>
            {action?.type !== "extend" && (
              <Input placeholder="Lý do (tuỳ chọn)" value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
            {action?.type === "extend" && (
              <Input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="Hạn mới (để trống = không hạn)" />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Huỷ</Button>
            <Button onClick={submit} variant={action?.type === "revoke" ? "destructive" : "default"}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
