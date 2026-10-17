import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, Github, ExternalLink, AlertTriangle } from "lucide-react";

type CheckStatus = "idle" | "checking" | "ok" | "not_found" | "private_or_no_access" | "error";

interface CheckResult {
  status: CheckStatus;
  httpStatus?: number;
  message: string;
  isPrivate?: boolean;
  defaultBranch?: string;
}

const LOVABLE_APP_SLUG = "lovable-dev"; // GitHub App slug used in install URL

export default function GitHubSyncCheck() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [result, setResult] = useState<CheckResult>({ status: "idle", message: "" });

  const runCheck = async () => {
    const o = owner.trim().replace(/^@/, "");
    const r = repo.trim();
    if (!o || !r) {
      setResult({ status: "error", message: "Nhập đủ owner và tên repo trước đã nhé." });
      return;
    }

    setResult({ status: "checking", message: "Đang kiểm tra…" });

    try {
      const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}`, {
        headers: { Accept: "application/vnd.github+json" },
      });

      if (res.status === 200) {
        const data = await res.json();
        setResult({
          status: "ok",
          httpStatus: 200,
          isPrivate: data.private,
          defaultBranch: data.default_branch,
          message: data.private
            ? "Repo tồn tại nhưng ở chế độ PRIVATE. Lovable GitHub App phải được tick chọn repo này thì mới sync được."
            : "Repo tồn tại và công khai. Nếu vẫn không sync được thì cần tick chọn repo trong GitHub App.",
        });
        return;
      }

      if (res.status === 404) {
        setResult({
          status: "private_or_no_access",
          httpStatus: 404,
          message:
            "GitHub trả về 404. Có 2 khả năng: (1) repo là PRIVATE và Lovable GitHub App chưa được cấp quyền truy cập; hoặc (2) tên owner/repo sai chính tả.",
        });
        return;
      }

      if (res.status === 403) {
        setResult({
          status: "error",
          httpStatus: 403,
          message: "GitHub API rate limit hoặc bị chặn. Thử lại sau vài phút.",
        });
        return;
      }

      setResult({
        status: "error",
        httpStatus: res.status,
        message: `GitHub trả về mã ${res.status}. Không rõ nguyên nhân — thử lại hoặc kiểm tra thủ công.`,
      });
    } catch (err) {
      setResult({
        status: "error",
        message: err instanceof Error ? err.message : "Lỗi mạng khi gọi GitHub API.",
      });
    }
  };

  const installUrl = owner
    ? `https://github.com/apps/${LOVABLE_APP_SLUG}/installations/new/permissions?target_id=${encodeURIComponent(owner)}`
    : `https://github.com/apps/${LOVABLE_APP_SLUG}/installations/new`;

  const settingsUrl = "https://github.com/settings/installations";

  const needsAccess =
    result.status === "private_or_no_access" ||
    (result.status === "ok" && result.isPrivate);

  return (
    <div className="container mx-auto max-w-3xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-full bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700]">
          <Github className="h-6 w-6 !text-black" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">Kiểm tra quyền GitHub App</h1>
          <p className="text-sm text-muted-foreground">
            Phát hiện lỗi "repository access" trước khi sync code từ Lovable sang GitHub.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bước 1 — Nhập repo cần sync</CardTitle>
          <CardDescription>Ví dụ owner: <code>vutonyhue</code>, repo: <code>ANGEL-AI</code></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="owner">Owner (user hoặc org)</Label>
              <Input
                id="owner"
                placeholder="vutonyhue"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="repo">Tên repository</Label>
              <Input
                id="repo"
                placeholder="ANGEL-AI"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <Button
            onClick={runCheck}
            disabled={result.status === "checking"}
            className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold hover:opacity-90"
          >
            {result.status === "checking" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang kiểm tra…
              </>
            ) : (
              "Kiểm tra quyền truy cập"
            )}
          </Button>

          {result.status !== "idle" && result.status !== "checking" && (
            <Alert
              variant={result.status === "ok" && !result.isPrivate ? "default" : "destructive"}
              className="mt-2"
            >
              <div className="flex items-start gap-2">
                {result.status === "ok" && !result.isPrivate ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : result.status === "ok" && result.isPrivate ? (
                  <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                )}
                <div className="space-y-1">
                  <AlertTitle className="flex items-center gap-2">
                    Kết quả
                    {result.httpStatus ? (
                      <Badge variant="outline">HTTP {result.httpStatus}</Badge>
                    ) : null}
                    {result.isPrivate ? <Badge variant="outline">private</Badge> : null}
                    {result.defaultBranch ? <Badge variant="outline">branch: {result.defaultBranch}</Badge> : null}
                  </AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      {(needsAccess || result.status === "ok") && (
        <Card>
          <CardHeader>
            <CardTitle>Bước 2 — Cấp quyền cho Lovable GitHub App</CardTitle>
            <CardDescription>
              Sync fail thường là do Lovable App chưa được tick chọn repo này. Làm theo 3 bước:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ol className="space-y-3 list-decimal list-inside">
              <li>
                Mở{" "}
                <a
                  href={settingsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-semibold inline-flex items-center gap-1"
                >
                  GitHub Installations
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                → tìm <strong>Lovable</strong> → bấm <strong>Configure</strong>.
              </li>
              <li>
                Ở phần <strong>Repository access</strong>, chọn <strong>All repositories</strong> (nhanh nhất),{" "}
                hoặc chọn <strong>Only select repositories</strong> rồi TICK <code>{repo || "ANGEL-AI"}</code>. Bấm{" "}
                <strong>Save</strong>.
              </li>
              <li>
                Quay lại Lovable → menu <strong>+ → GitHub → Connect project</strong> → chọn đúng account chứa repo →
                chọn <code>{repo || "ANGEL-AI"}</code>.
              </li>
            </ol>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline">
                <a href={settingsUrl} target="_blank" rel="noreferrer">
                  Mở Installations <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={installUrl} target="_blank" rel="noreferrer">
                  Cài / cấu hình Lovable App <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
              <Button
                onClick={runCheck}
                className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold"
              >
                Kiểm tra lại
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Ghi chú</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>• Kiểm tra này gọi GitHub public API — không đọc token, không đăng nhập.</p>
          <p>• Repo <strong>public</strong> trả về 200 dù App có quyền hay không. Với public repo, nếu sync vẫn fail thì lỗi ở khâu chọn account/link project trong Lovable, không phải ở tick repo.</p>
          <p>• Repo <strong>private</strong> mà trả 404 thì gần như chắc chắn Lovable App chưa được tick repo → làm Bước 2.</p>
        </CardContent>
      </Card>
    </div>
  );
}
