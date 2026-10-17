import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useSlashCandidates,
  useSlashProposals,
  useProposeAutoSlash,
  useApproveSlashProposal,
  useRejectSlashProposal,
  type SlashCandidate,
  type SlashProposal,
} from "@/hooks/useSlashAutomation";
import { AlertTriangle, Sparkles, CheckCircle2, XCircle, RefreshCw, Gavel } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

const severityColor: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
};

const detectionLabel: Record<string, string> = {
  abuse_flags: "🚨 Lạm dụng",
  reciprocal_loop: "🔄 Loop A↔B",
  attestation_burst: "💥 Burst",
  sybil_cluster: "🕸️ Sybil cluster",
  manual: "✋ Thủ công",
};

export function SlashAutomationPanel() {
  const candidates = useSlashCandidates(50);
  const pending = useSlashProposals("pending");
  const history = useSlashProposals("approved");
  const propose = useProposeAutoSlash();
  const approve = useApproveSlashProposal();
  const reject = useRejectSlashProposal();

  const [reviewProp, setReviewProp] = useState<SlashProposal | null>(null);
  const [overridePct, setOverridePct] = useState<string>("");
  const [notes, setNotes] = useState("");

  const openReview = (p: SlashProposal) => {
    setReviewProp(p);
    setOverridePct(String(Math.round(p.suggested_slash_pct * 100)));
    setNotes("");
  };

  const handleApprove = () => {
    if (!reviewProp) return;
    const pct = Number(overridePct) / 100;
    approve.mutate(
      { proposal_id: reviewProp.id, override_pct: pct, notes },
      { onSuccess: (r) => r?.success && setReviewProp(null) }
    );
  };

  const handleReject = () => {
    if (!reviewProp) return;
    reject.mutate(
      { proposal_id: reviewProp.id, notes },
      { onSuccess: (r) => r?.success && setReviewProp(null) }
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Gavel className="h-4 w-4" /> Validator Slash Automation
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Tự động phát hiện validator gian lận và đề xuất slash. Admin duyệt 1-click.
            </p>
          </div>
          <Button
            onClick={() => propose.mutate(20)}
            disabled={propose.isPending}
            size="sm"
            variant="default"
          >
            <Sparkles className={`h-4 w-4 mr-2 ${propose.isPending ? "animate-pulse" : ""}`} />
            Tạo đề xuất từ phát hiện
          </Button>
        </CardHeader>
      </Card>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="text-xs">
            ⏳ Chờ duyệt {pending.data && pending.data.length > 0 && `(${pending.data.length})`}
          </TabsTrigger>
          <TabsTrigger value="candidates" className="text-xs">
            🔍 Phát hiện realtime {candidates.data && `(${candidates.data.length})`}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            ✅ Đã slash
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {pending.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (pending.data || []).length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Không có đề xuất chờ duyệt. Bấm "Tạo đề xuất" để quét hệ thống.
                </div>
              ) : (
                <div className="divide-y">
                  {pending.data!.map((p) => (
                    <ProposalRow key={p.id} p={p} onReview={openReview} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="candidates" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {candidates.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (candidates.data || []).length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Không phát hiện validator nào đáng nghi 🌟
                </div>
              ) : (
                <div className="divide-y">
                  {candidates.data!.map((c) => (
                    <CandidateRow key={`${c.stake_id}-${c.detection_type}`} c={c} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {history.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (history.data || []).length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Chưa có lịch sử slash</div>
              ) : (
                <div className="divide-y">
                  {history.data!.map((p) => (
                    <div key={p.id} className="p-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={severityColor[p.severity] || ""}>{p.severity}</Badge>
                        <span className="text-xs">{detectionLabel[p.detection_type] || p.detection_type}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          slashed {Number(p.slashed_amount || 0).toLocaleString()} CLY ({Math.round((p.applied_slash_pct || 0) * 100)}%)
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{p.reason}</div>
                      {p.review_notes && <div className="text-xs italic mt-1">"{p.review_notes}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review dialog */}
      <Dialog open={!!reviewProp} onOpenChange={(o) => !o && setReviewProp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Duyệt đề xuất Slash
            </DialogTitle>
          </DialogHeader>
          {reviewProp && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={severityColor[reviewProp.severity]}>{reviewProp.severity}</Badge>
                  <span className="text-xs font-mono">{detectionLabel[reviewProp.detection_type] || reviewProp.detection_type}</span>
                </div>
                <div className="text-sm">{reviewProp.reason}</div>
                <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(reviewProp.evidence, null, 2)}
                </pre>
              </div>
              <div>
                <label className="text-xs">Slash % (override, mặc định {Math.round(reviewProp.suggested_slash_pct * 100)}%)</label>
                <Input
                  type="number"
                  value={overridePct}
                  onChange={(e) => setOverridePct(e.target.value)}
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <label className="text-xs">Ghi chú admin (optional)</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleApprove}
                  disabled={approve.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {approve.isPending ? "Đang xử lý..." : "Duyệt & Slash"}
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleReject} disabled={reject.isPending}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Từ chối
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProposalRow({ p, onReview }: { p: SlashProposal; onReview: (p: SlashProposal) => void }) {
  return (
    <div className="p-3 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Badge className={severityColor[p.severity] || ""}>{p.severity}</Badge>
        <span className="text-xs">{detectionLabel[p.detection_type] || p.detection_type}</span>
        <span className="text-xs font-mono text-muted-foreground">~{Math.round(p.suggested_slash_pct * 100)}%</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {formatDistanceToNow(new Date(p.detected_at), { addSuffix: true, locale: vi })}
        </span>
      </div>
      <div className="text-sm">{p.reason}</div>
      <div className="flex justify-end mt-2">
        <Button size="sm" variant="outline" onClick={() => onReview(p)}>
          <Gavel className="h-3 w-3 mr-1" /> Xem & Duyệt
        </Button>
      </div>
    </div>
  );
}

function CandidateRow({ c }: { c: SlashCandidate }) {
  return (
    <div className="p-3 text-sm">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Badge className={severityColor[c.severity] || ""}>{c.severity}</Badge>
        <span className="text-xs">{detectionLabel[c.detection_type] || c.detection_type}</span>
        <span className="text-xs font-mono text-muted-foreground">~{Math.round(c.suggested_slash_pct * 100)}%</span>
        <span className="font-medium ml-auto">{c.display_name}</span>
      </div>
      <div className="text-xs text-muted-foreground">{c.reason}</div>
      <div className="text-xs font-mono text-muted-foreground truncate">{c.did}</div>
    </div>
  );
}
