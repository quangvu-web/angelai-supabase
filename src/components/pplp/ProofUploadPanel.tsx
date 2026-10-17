import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Upload, Link as LinkIcon, FileText, CheckCircle, Clock, AlertTriangle } from "lucide-react";

// Actions performed ON the platform — system is the proof, no manual upload needed
const SYSTEM_VERIFIED_ACTIONS = new Set([
  "QUESTION_ASK",
  "JOURNAL_WRITE",
  "GRATITUDE_PRACTICE",
  "DAILY_RITUAL",
  "POST_CREATE",
  "COMMENT_CREATE",
  "CONTENT_CREATE",
  "CONTENT_SHARE",
  "HELP_PROVIDE",
  "COMMUNITY_ENGAGE",
  "PROFILE_COMPLETE",
  "LEARN_COMPLETE",
  "DAILY_LOGIN",
  "POST_ENGAGEMENT",
]);

interface PendingAction {
  id: string;
  action_type: string;
  title: string | null;
  status: string;
  created_at: string;
  proofCount: number;
}

type ProofType = "url" | "file" | "text";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof CheckCircle }> = {
  proof_pending: { label: "Chờ bằng chứng", variant: "destructive", icon: AlertTriangle },
  submitted: { label: "Đã nộp", variant: "secondary", icon: Clock },
  under_review: { label: "Đang xét duyệt", variant: "default", icon: Clock },
  validated: { label: "Đã xác thực", variant: "default", icon: CheckCircle },
};

export function ProofUploadPanel() {
  const { user } = useAuth();
  const { currentLanguage: language } = useLanguage();
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [proofType, setProofType] = useState<ProofType>("url");
  const [proofUrl, setProofUrl] = useState("");
  const [proofText, setProofText] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchActions();
  }, [user]);

  const fetchActions = async () => {
    if (!user) return;
    setLoading(true);

    const { data: actionsData } = await supabase
      .from("pplp_actions")
      .select("id, action_type, status, created_at")
      .eq("actor_id", user.id)
      .in("status", ["pending", "scoring"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (!actionsData) {
      setActions([]);
      setLoading(false);
      return;
    }

    // Count existing proofs for each action
    const actionIds = actionsData.map((a: any) => a.id);
    const { data: proofsData } = await supabase
      .from("proofs")
      .select("action_id")
      .in("action_id", actionIds);

    const proofCounts: Record<string, number> = {};
    proofsData?.forEach((p) => {
      proofCounts[p.action_id] = (proofCounts[p.action_id] || 0) + 1;
    });

    // Filter out system-verified actions — platform is the proof
    const filteredActions = (actionsData as any[])
      .filter((a: any) => !SYSTEM_VERIFIED_ACTIONS.has(a.action_type))
      .map((a: any) => ({
        id: a.id,
        action_type: a.action_type,
        title: null,
        status: a.status,
        created_at: a.created_at,
        proofCount: proofCounts[a.id] || 0,
      }));

    setActions(filteredActions);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !selectedAction) return;

    // Validate
    if (proofType === "url" && !proofUrl.match(/^https?:\/\/.+/)) {
      toast({ title: "URL không hợp lệ", description: "Vui lòng nhập URL bắt đầu bằng http:// hoặc https://", variant: "destructive" });
      return;
    }
    if (proofType === "text" && proofText.trim().length < 10) {
      toast({ title: "Nội dung quá ngắn", description: "Bằng chứng text cần ít nhất 10 ký tự", variant: "destructive" });
      return;
    }
    if (proofType === "file" && !proofFile) {
      toast({ title: "Chưa chọn file", variant: "destructive" });
      return;
    }
    if (proofType === "file" && proofFile && proofFile.size > 20 * 1024 * 1024) {
      toast({ title: "File quá lớn", description: "Giới hạn 20MB", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      let uploadedUrl = "";

      if (proofType === "file" && proofFile) {
        const ext = proofFile.name.split(".").pop();
        const path = `${user.id}/${selectedAction}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("proofs")
          .upload(path, proofFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("proofs").getPublicUrl(path);
        uploadedUrl = urlData.publicUrl;
      }

      // Call the API to attach proof
      const proofPayload: Record<string, string> = {
        proof_type: proofType === "url" ? "link" : proofType === "file" ? "media" : "text_log",
      };

      if (proofType === "url") proofPayload.proof_url = proofUrl;
      if (proofType === "file") proofPayload.proof_url = uploadedUrl;
      if (proofType === "text") proofPayload.proof_url = proofText;

      const { error } = await supabase.functions.invoke("pplp-api-v1", {
        body: {
          path: `/v1/actions/${selectedAction}/proofs`,
          method: "POST",
          ...proofPayload,
        },
      });

      if (error) throw error;

      toast({ title: "✅ Đã nộp bằng chứng", description: "Bằng chứng sẽ được xác thực tự động" });

      // Reset form
      setProofUrl("");
      setProofText("");
      setProofFile(null);
      setSelectedAction(null);
      fetchActions();
    } catch (err: any) {
      toast({ title: "Lỗi", description: err.message || "Không thể nộp bằng chứng", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const pendingActions = actions.filter((a) => a.status === "pending");
  const otherActions = actions.filter((a) => a.status !== "pending");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          {language === "vi" ? "Nộp Bằng Chứng" : "Submit Proof"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingActions.length === 0 && otherActions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {language === "vi" ? "Không có hành động nào cần bằng chứng" : "No actions require proof"}
          </p>
        ) : (
          <>
            {/* Pending actions */}
            {pendingActions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-destructive">
                  ⚠️ {pendingActions.length} {language === "vi" ? "hành động chờ bằng chứng" : "actions pending proof"}
                </p>
                {pendingActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => setSelectedAction(action.id === selectedAction ? null : action.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedAction === action.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium capitalize">
                          {action.title || action.action_type.replace(/_/g, " ")}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {new Date(action.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {action.proofCount > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {action.proofCount} proof
                          </Badge>
                        )}
                        <Badge variant="destructive" className="text-[10px]">
                          Chờ proof
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Upload form */}
            {selectedAction && (
              <div className="space-y-3 p-4 bg-muted/20 rounded-lg border border-dashed border-primary/30">
                <p className="text-xs font-medium">
                  {language === "vi" ? "Chọn loại bằng chứng:" : "Select proof type:"}
                </p>
                <div className="flex gap-2">
                  {([
                    { type: "url" as ProofType, icon: LinkIcon, label: "URL" },
                    { type: "file" as ProofType, icon: Upload, label: "File" },
                    { type: "text" as ProofType, icon: FileText, label: "Text" },
                  ]).map(({ type, icon: Icon, label }) => (
                    <Button
                      key={type}
                      variant={proofType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProofType(type)}
                      className="gap-1.5"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </Button>
                  ))}
                </div>

                {proofType === "url" && (
                  <Input
                    placeholder="https://example.com/proof"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                  />
                )}

                {proofType === "file" && (
                  <div>
                    <Input
                      type="file"
                      accept="image/*,video/*,.pdf,.doc,.docx"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Ảnh, video, PDF — tối đa 20MB
                    </p>
                  </div>
                )}

                {proofType === "text" && (
                  <textarea
                    placeholder={language === "vi" ? "Mô tả bằng chứng chi tiết..." : "Describe your proof in detail..."}
                    value={proofText}
                    onChange={(e) => setProofText(e.target.value)}
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-primary to-primary-deep text-white"
                >
                  {submitting ? "Đang nộp..." : language === "vi" ? "Nộp bằng chứng" : "Submit Proof"}
                </Button>
              </div>
            )}

            {/* Other actions with status */}
            {otherActions.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {language === "vi" ? "Đang xử lý" : "In progress"}
                </p>
                {otherActions.map((action) => {
                  const statusInfo = STATUS_BADGES[action.status] || STATUS_BADGES.submitted;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div key={action.id} className="flex items-center justify-between p-2 rounded bg-muted/20 text-xs">
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="capitalize">{action.title || action.action_type.replace(/_/g, " ")}</span>
                      </div>
                      <Badge variant={statusInfo.variant} className="text-[10px]">
                        {statusInfo.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
