import { useNavigate } from "@/lib/router-compat";
import { smartBack } from "@/lib/smartBack";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ExternalLink, Sparkles, Clock, Heart, Flag, Wallet } from "lucide-react";
import { useConnectorStats } from "@/hooks/useConnectorStats";
import { useConnectorDispute } from "@/hooks/useConnectorDispute";
import { useAuth } from "@/hooks/useAuth";

function formatCountdown(expireIso: string | null): string {
  if (!expireIso) return "—";
  const ms = new Date(expireIso).getTime() - Date.now();
  if (ms <= 0) return "Đã đóng cửa sổ 48h";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `Còn ${h}h ${m}p`;
}

function shortHash(h: string) {
  return h.slice(0, 8) + "…" + h.slice(-6);
}

export default function Connector() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useConnectorStats();
  const dispute = useConnectorDispute();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!user) {
    return (
      <div className="container max-w-2xl py-10 text-center">
        <p className="text-muted-foreground">Cần đăng nhập để xem Connector.</p>
        <Button className="mt-4" onClick={() => navigate("/auth")}>Đăng nhập</Button>
      </div>
    );
  }

  const myConnector = data?.my_connector;
  const cp = data?.my_connector_profile;
  const profile = data?.profile;
  const profileMap = new Map((data?.connectee_profiles ?? []).map((p) => [p.user_id, p]));

  return (
    <div className="container max-w-3xl py-6 px-4">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 min-h-[44px] gap-2"
        onClick={() => smartBack(navigate)}
        aria-label="Quay lại"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </Button>

      {/* Hero card */}
      <Card className="mb-6 overflow-hidden border-0">
        <div
          className="p-6 text-black"
          style={{
            background:
              "linear-gradient(135deg, #b8860b 0%, #daa520 30%, #ffd700 60%, #ffec8b 100%)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5" />
            <h1 className="!text-black font-extrabold text-2xl">Connector của bạn</h1>
          </div>
          <p className="!text-black font-semibold text-sm opacity-90">
            Người đầu tiên gửi bạn token on-chain trong 48h kể từ khi tạo tài khoản.
            Đây là người đã “mở dòng chảy” cho bạn vào hệ sinh thái FUN.
          </p>
        </div>
      </Card>

      {/* Section 1: My Connector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-amber-500" />
            Connector chính thức
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : myConnector ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {cp?.avatar_url ? (
                  <img src={cp.avatar_url} alt="" className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold">
                    {cp?.display_name ?? "Người gửi ngoài hệ"}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {myConnector.connector_wallet}
                  </div>
                </div>
                <Badge variant={myConnector.status === "confirmed" ? "default" : "secondary"}>
                  {myConnector.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Token</div>
                  <div className="font-medium">
                    {myConnector.token_amount} {myConnector.token_symbol}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Xác nhận</div>
                  <div className="font-medium">
                    {myConnector.confirmed_at
                      ? new Date(myConnector.confirmed_at).toLocaleString("vi-VN")
                      : "—"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://testnet.bscscan.com/tx/${myConnector.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-amber-600 hover:underline"
                >
                  Xem giao dịch <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-xs text-muted-foreground self-center">
                  {shortHash(myConnector.tx_hash)}
                </span>
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="min-h-[44px] gap-2">
                    <Flag className="w-4 h-4" /> Báo cáo nghi ngờ
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Báo cáo nghi ngờ Connector</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Bạn có 7 ngày kể từ khi xác nhận để báo cáo. Admin sẽ xem xét và có thể
                    thu hồi nếu phát hiện gian lận.
                  </p>
                  <Textarea
                    placeholder="Lý do (vd: ví này là ví phụ của tôi, gửi nhầm, gian lận…)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                  />
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        if (!reason.trim()) return;
                        dispute.mutate(
                          { connector_id: myConnector.id, reason: reason.trim() },
                          { onSuccess: () => { setOpen(false); setReason(""); } },
                        );
                      }}
                      disabled={dispute.isPending || !reason.trim()}
                    >
                      {dispute.isPending ? "Đang gửi…" : "Gửi báo cáo"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-600">
                <Clock className="w-4 h-4" />
                <span className="font-medium">
                  {formatCountdown(profile?.connector_window_expires_at ?? null)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Bạn chưa có Connector. Hãy chia sẻ ví của bạn cho người bạn tin tưởng —
                người đầu tiên gửi token on-chain hợp lệ sẽ được ghi nhận là Connector chính
                thức và nhận badge <strong>Light Connector</strong>.
              </p>
              <div className="text-xs text-muted-foreground">
                Quy tắc: token whitelist (CAMLY/BNB), giá trị ≥ ngưỡng tối thiểu, không phải
                ví của chính bạn, không bị flag sybil.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: People I connected */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Bạn đã mở dòng chảy cho
            </span>
            <Badge variant="secondary">{profile?.connector_count ?? 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : data?.connectees && data.connectees.length > 0 ? (
            <div className="space-y-2">
              {data.connectees.map((c) => {
                const p = profileMap.get(c.newcomer_user_id);
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {p?.display_name ?? "Newcomer"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.token_amount} {c.token_symbol} ·{" "}
                        {c.confirmed_at
                          ? new Date(c.confirmed_at).toLocaleDateString("vi-VN")
                          : "—"}
                      </div>
                    </div>
                    <Badge variant={c.status === "confirmed" ? "default" : "secondary"}>
                      {c.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Bạn chưa làm Connector cho ai. Hãy là người đầu tiên gửi cho một người bạn mới
              vừa tạo tài khoản — bạn sẽ nhận badge <strong>Light Connector</strong> và Light
              Score.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground mt-6 italic">
        “Referral is claimed by words. Connector is proven by giving.”
      </p>
    </div>
  );
}
