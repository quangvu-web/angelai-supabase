import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  useMyCommitments,
  useCommitPrivateAttestation,
  useRevealAttestation,
  buildCommitmentHash,
  genNonce,
  type ZkCommitment,
} from "@/hooks/useZkAndOnchain";
import { useDID } from "@/hooks/useDID";
import { Shield, Eye, EyeOff, Lock, Sparkles, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";

export function PrivateAttestationPanel() {
  const { data: myDid } = useDID();
  const commitments = useMyCommitments();
  const commitMut = useCommitPrivateAttestation();
  const revealMut = useRevealAttestation();

  const [openCommit, setOpenCommit] = useState(false);
  const [revealItem, setRevealItem] = useState<ZkCommitment | null>(null);

  // commit form
  const [toDid, setToDid] = useState("");
  const [attType, setAttType] = useState("trust_endorsement");
  const [weight, setWeight] = useState("0.05");
  const [nonce, setNonce] = useState(genNonce());
  const [hint, setHint] = useState("private_endorsement");

  // store nonce per commitment-id locally for reveal
  const handleCommit = async () => {
    if (!myDid?.id) return toast.error("Cần DID");
    if (!toDid) return toast.error("Cần DID người nhận");
    const w = Number(weight);
    if (isNaN(w) || w <= 0 || w > 1) return toast.error("Weight 0-1");

    const hash = await buildCommitmentHash({
      fromDid: myDid.id,
      toDid,
      attestationType: attType,
      weight: w,
      nonce,
    });

    // store secret in localStorage so user can reveal later
    commitMut.mutate(
      { commitment_hash: hash, attestation_type_hint: hint, privacy_level: "private" },
      {
        onSuccess: (res: any) => {
          if (res?.success) {
            try {
              const key = `zk_secret_${res.id}`;
              localStorage.setItem(key, JSON.stringify({ to_did: toDid, attestation_type: attType, weight: w, nonce, hash }));
            } catch {}
            setOpenCommit(false);
            setNonce(genNonce());
            setToDid("");
          }
        },
      }
    );
  };

  const handleReveal = async (c: ZkCommitment) => {
    const key = `zk_secret_${c.id}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      toast.error("Không tìm thấy secret để reveal — chỉ có thể reveal trên thiết bị đã commit");
      return;
    }
    const secret = JSON.parse(raw);
    revealMut.mutate(
      {
        commitment_id: c.id,
        to_did: secret.to_did,
        attestation_type: secret.attestation_type,
        weight: secret.weight,
        nonce: secret.nonce,
        expected_hash: secret.hash,
      },
      {
        onSuccess: (res: any) => {
          if (res?.success) {
            localStorage.removeItem(key);
            setRevealItem(null);
          }
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Chứng thực riêng tư (ZK)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Cam kết hash trước, tiết lộ sau. Nội dung được giữ kín cho đến khi bạn quyết định công khai.
          </p>
        </div>
        <Dialog open={openCommit} onOpenChange={setOpenCommit}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Lock className="h-4 w-4 mr-1" /> Commit mới
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> Tạo commitment riêng tư
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  Hash sẽ được tính trên trình duyệt (sha256) rồi gửi lên server. Server không biết nội dung.
                  Secret (nonce + dữ liệu) lưu cục bộ — cần thiết bị này để reveal.
                </div>
              </div>
              <div>
                <Label className="text-xs">DID người nhận (uuid)</Label>
                <Input value={toDid} onChange={(e) => setToDid(e.target.value)} placeholder="uuid của to_did" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Loại</Label>
                  <Input value={attType} onChange={(e) => setAttType(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Weight (0-1)</Label>
                  <Input type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Hint công khai</Label>
                <Input value={hint} onChange={(e) => setHint(e.target.value)} />
              </div>
              <div className="text-xs font-mono text-muted-foreground truncate">nonce: {nonce}</div>
              <Button className="w-full" onClick={handleCommit} disabled={commitMut.isPending}>
                {commitMut.isPending ? "Đang commit..." : "Commit hash"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {commitments.isLoading ? (
          <Skeleton className="h-32" />
        ) : (commitments.data || []).length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Chưa có commitment nào</div>
        ) : (
          <div className="divide-y">
            {commitments.data!.map((c) => (
              <div key={c.id} className="p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={c.status === "revealed" ? "default" : c.status === "expired" ? "destructive" : "secondary"}>
                    {c.status === "committed" && <Lock className="h-3 w-3 mr-1" />}
                    {c.status === "revealed" && <Eye className="h-3 w-3 mr-1" />}
                    {c.status === "expired" && <EyeOff className="h-3 w-3 mr-1" />}
                    {c.status}
                  </Badge>
                  <span className="text-xs">{c.attestation_type_hint}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: vi })}
                  </span>
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate">{c.commitment_hash}</div>
                {c.status === "committed" && (
                  <div className="flex justify-end mt-2">
                    <Button size="sm" variant="outline" onClick={() => handleReveal(c)} disabled={revealMut.isPending}>
                      <Eye className="h-3 w-3 mr-1" /> Reveal
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
