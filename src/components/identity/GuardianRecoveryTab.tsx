import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, ShieldCheck, ShieldX, UserPlus, Inbox, Clock, CheckCircle2, XCircle, Play, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useMyGuardians, useGuardianInbox, useMyRecoveryRequests, usePendingRecoveryForGuardian,
  useAddGuardian, useAcceptGuardianInvite, useRevokeGuardian,
  useCreateRecoveryRequest, useVoteRecoveryRequest, useExecuteRecovery,
} from "@/hooks/useRecovery";
import { toast } from "sonner";

const REQUEST_TYPES = [
  { value: "wallet_change", label: "Đổi ví Web3" },
  { value: "account_unlock", label: "Mở khoá tài khoản" },
  { value: "did_recovery", label: "Khôi phục DID" },
  { value: "email_recovery", label: "Khôi phục email" },
];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active": case "approved": case "executed": return "default";
    case "pending": return "secondary";
    case "rejected": case "expired": case "cancelled": return "destructive";
    default: return "outline";
  }
}

export function GuardianRecoveryTab() {
  const { data: guardians = [], isLoading: loadingG } = useMyGuardians();
  const { data: inbox = [], isLoading: loadingI } = useGuardianInbox();
  const { data: requests = [], isLoading: loadingR } = useMyRecoveryRequests();
  const { data: pendingForMe = [] } = usePendingRecoveryForGuardian();

  const activeGuardians = guardians.filter((g) => g.status === "active").length;
  const canRecover = activeGuardians >= 3;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="guardians">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="guardians">
            <Shield className="h-4 w-4 mr-1" /> Guardian ({activeGuardians})
          </TabsTrigger>
          <TabsTrigger value="my-requests">
            <Clock className="h-4 w-4 mr-1" /> Yêu cầu ({requests.filter(r => r.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="inbox">
            <Inbox className="h-4 w-4 mr-1" /> Inbox ({pendingForMe.length})
          </TabsTrigger>
        </TabsList>

        {/* GUARDIANS */}
        <TabsContent value="guardians" className="space-y-3 mt-4">
          <Card>
            <CardHeader className="flex-row justify-between items-center">
              <CardTitle className="text-base">Guardian của tôi</CardTitle>
              <AddGuardianDialog />
            </CardHeader>
            <CardContent className="space-y-2">
              {!canRecover && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  Cần ≥3 guardian active để mở chức năng khôi phục (hiện có {activeGuardians}).
                </div>
              )}
              {loadingG ? <Skeleton className="h-20 w-full" /> :
                guardians.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    Chưa có guardian nào. Thêm 3-5 người tin cậy.
                  </div>
                ) : (
                  guardians.map((g) => <GuardianRow key={g.id} g={g} />)
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MY REQUESTS */}
        <TabsContent value="my-requests" className="space-y-3 mt-4">
          <Card>
            <CardHeader className="flex-row justify-between items-center">
              <CardTitle className="text-base">Yêu cầu khôi phục</CardTitle>
              <CreateRecoveryDialog disabled={!canRecover} />
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingR ? <Skeleton className="h-20 w-full" /> :
                requests.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    Chưa có yêu cầu khôi phục nào.
                  </div>
                ) : (
                  requests.map((r) => <RequestRow key={r.id} r={r} />)
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INBOX */}
        <TabsContent value="inbox" className="space-y-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lời mời guardian</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingI ? <Skeleton className="h-20 w-full" /> :
                inbox.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">Không có lời mời.</div>
                ) : (
                  inbox.map((i) => <InboxRow key={i.relationship_id} i={i} />)
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Yêu cầu chờ vote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingForMe.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">Không có yêu cầu nào cần vote.</div>
              ) : (
                pendingForMe.map((p) => <PendingVoteRow key={p.request_id} p={p} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ========== Sub components ========== */

function GuardianRow({ g }: { g: any }) {
  const revoke = useRevokeGuardian();
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={g.avatar_url ?? undefined} />
        <AvatarFallback>{(g.display_name || g.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{g.display_name || g.email || "(no name)"}</div>
        <div className="text-xs text-muted-foreground truncate">{g.email}</div>
      </div>
      <Badge variant={statusVariant(g.status)} className="text-xs">{g.status}</Badge>
      <Button size="sm" variant="ghost" onClick={() => revoke.mutate(g.id)} disabled={revoke.isPending}>
        <ShieldX className="h-4 w-4" />
      </Button>
    </div>
  );
}

function InboxRow({ i }: { i: any }) {
  const accept = useAcceptGuardianInvite();
  const revoke = useRevokeGuardian();
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={i.avatar_url ?? undefined} />
        <AvatarFallback>{(i.display_name || i.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{i.display_name || i.email || "(no name)"}</div>
        <div className="text-xs text-muted-foreground">
          {i.status === "active" ? `Bạn là guardian (${i.pending_requests} yêu cầu chờ)` : "Mời bạn làm guardian"}
        </div>
      </div>
      {i.status === "pending" ? (
        <>
          <Button size="sm" onClick={() => accept.mutate(i.relationship_id)} disabled={accept.isPending}>
            <ShieldCheck className="h-4 w-4 mr-1" /> Đồng ý
          </Button>
          <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.relationship_id)}>
            <XCircle className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.relationship_id)}>
          <ShieldX className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function RequestRow({ r }: { r: any }) {
  const exec = useExecuteRecovery();
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{REQUEST_TYPES.find(t => t.value === r.request_type)?.label || r.request_type}</div>
          {r.reason && <div className="text-xs text-muted-foreground">{r.reason}</div>}
        </div>
        <Badge variant={statusVariant(r.status)} className="text-xs">{r.status}</Badge>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {r.approvals_count}/{r.required_approvals}
        <XCircle className="h-3 w-3 text-rose-500 ml-2" /> {r.rejections_count}
        <span className="ml-auto">Hết hạn: {new Date(r.expires_at).toLocaleDateString("vi-VN")}</span>
      </div>
      {r.status === "approved" && (
        <Button size="sm" className="w-full" onClick={() => exec.mutate(r.id)} disabled={exec.isPending}>
          <Play className="h-4 w-4 mr-1" /> Thực thi khôi phục
        </Button>
      )}
    </div>
  );
}

function PendingVoteRow({ p }: { p: any }) {
  const vote = useVoteRecoveryRequest();
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={p.avatar_url ?? undefined} />
          <AvatarFallback>{(p.display_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{p.display_name || "(no name)"}</div>
          <div className="text-xs text-muted-foreground">
            {REQUEST_TYPES.find(t => t.value === p.request_type)?.label}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{p.approvals_count}/{p.required_approvals}</span>
      </div>
      {p.reason && <div className="text-xs text-muted-foreground italic">"{p.reason}"</div>}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => vote.mutate({ request_id: p.request_id, decision: "approve" })} disabled={vote.isPending}>
          <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
        </Button>
        <Button size="sm" variant="destructive" className="flex-1" onClick={() => vote.mutate({ request_id: p.request_id, decision: "reject" })} disabled={vote.isPending}>
          <XCircle className="h-4 w-4 mr-1" /> Reject
        </Button>
      </div>
    </div>
  );
}

/* ========== Dialogs ========== */

function AddGuardianDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const add = useAddGuardian();

  const search = async () => {
    if (!query.trim()) return;
    const { data, error } = await supabase.rpc("search_user_for_attestation", { _query: query.trim() });
    if (error) { toast.error(error.message); return; }
    setResults((data || []).slice(0, 5));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><UserPlus className="h-4 w-4 mr-1" />Thêm</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Thêm Guardian</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Email / username / DID" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()} />
            <Button size="sm" onClick={search}><Search className="h-4 w-4" /></Button>
          </div>
          {results.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-auto">
              {results.map((u: any) => (
                <button key={u.user_id} onClick={() => {
                  add.mutate({ guardian_user_id: u.user_id, note });
                  setOpen(false); setQuery(""); setResults([]); setNote("");
                }}
                  className="w-full flex items-center gap-2 rounded-lg border p-2 hover:bg-muted text-left">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={u.avatar_url ?? undefined} />
                    <AvatarFallback>{(u.display_name || "?").slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.display_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <Textarea placeholder="Ghi chú (tuỳ chọn)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateRecoveryDialog({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("wallet_change");
  const [reason, setReason] = useState("");
  const create = useCreateRecoveryRequest();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>Tạo yêu cầu</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Yêu cầu khôi phục</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REQUEST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea placeholder="Lý do khôi phục..." value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          <div className="text-xs text-muted-foreground">
            • Cần ≥2/3 guardian approve. • Cooldown 72h giữa các yêu cầu. • Hết hạn sau 7 ngày.
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => {
            create.mutate({ request_type: type, reason }, { onSuccess: () => { setOpen(false); setReason(""); } });
          }} disabled={create.isPending}>Tạo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
