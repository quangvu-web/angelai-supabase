import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, FilePlus2, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FeedbackRow = {
  id: string;
  user_id: string;
  question_text: string;
  answer_text: string;
  feedback_type: "like" | "dislike" | "outdated" | "needs_update";
  feedback_reason: string | null;
  status: "open" | "reviewed" | "resolved" | "dismissed";
  linked_document_id: string | null;
  admin_note: string | null;
  created_at: string;
};

const feedbackLabels: Record<string, string> = {
  like: "Dung",
  dislike: "Chua dung",
  outdated: "Thong tin cu",
  needs_update: "Can bo sung",
};

export default function KnowledgeFeedbackReviewPanel() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("chat_feedback")
      .select("id,user_id,question_text,answer_text,feedback_type,feedback_reason,status,linked_document_id,admin_note,created_at")
      .in("feedback_type", ["dislike", "outdated", "needs_update"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as FeedbackRow[]);
  };

  useEffect(() => { load(); }, [status]);

  const review = async (row: FeedbackRow, nextStatus: "reviewed" | "resolved" | "dismissed") => {
    const { error } = await (supabase as any).rpc("review_chat_feedback", {
      _id: row.id,
      _status: nextStatus,
      _admin_note: notes[row.id] || row.admin_note || null,
      _linked_document_id: row.linked_document_id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Da cap nhat feedback");
    load();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Knowledge Feedback Review
          </div>
          <div className="text-xs text-muted-foreground">
            Cac bao sai, thong tin cu, va yeu cau bo sung tu cau tra loi cua Angel AI.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="border rounded-md divide-y max-h-[520px] overflow-y-auto">
        {loading && <div className="p-6 text-center text-sm text-muted-foreground">Dang tai...</div>}
        {!loading && rows.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Khong co feedback can review.</div>
        )}
        {rows.map((row) => (
          <div key={row.id} className="p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={row.feedback_type === "outdated" ? "destructive" : "secondary"}>
                {feedbackLabels[row.feedback_type] ?? row.feedback_type}
              </Badge>
              <Badge variant="outline">{row.status}</Badge>
              <span className="text-[11px] text-muted-foreground">
                {new Date(row.created_at).toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-md bg-muted p-2">
                <div className="text-[11px] font-semibold mb-1">Question</div>
                <p className="text-xs whitespace-pre-wrap">{row.question_text}</p>
              </div>
              <div className="rounded-md bg-muted p-2">
                <div className="text-[11px] font-semibold mb-1">Answer preview</div>
                <p className="text-xs whitespace-pre-wrap">{row.answer_text.slice(0, 700)}</p>
              </div>
            </div>

            <Textarea
              value={notes[row.id] ?? row.admin_note ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
              placeholder="Admin note / huong cap nhat knowledge..."
              className="min-h-16 text-xs"
            />

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => review(row, "dismissed")}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Dismiss
              </Button>
              <Button size="sm" variant="outline" onClick={() => review(row, "reviewed")}>
                <FilePlus2 className="h-3.5 w-3.5 mr-1" /> Mark reviewed
              </Button>
              <Button size="sm" onClick={() => review(row, "resolved")}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolve
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
