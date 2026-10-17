import { useState, useMemo } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAttesterSigning, MultisigMintRequest } from "@/hooks/useAttesterSigning";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Shield, CheckCircle2, Clock, RefreshCw, Loader2, AlertCircle, Sparkles, ArrowLeft, CheckSquare, Info, ChevronDown, ChevronUp } from "lucide-react";
import { GOV_GROUPS, SIGNATURE_ORDER, GovGroupName, REQUIRED_SIGNATURES } from "@/lib/govGroups";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";
import { smartBack } from "@/lib/smartBack";

function SignatureStatus({ request }: { request: MultisigMintRequest }) {
  const completed = request.multisig_completed_groups || [];
  return (
    <div className="space-y-2">
      {SIGNATURE_ORDER.map((group) => {
        const g = GOV_GROUPS[group];
        const signed = completed.includes(group);
        const sigData = request.multisig_signatures?.[group];
        return (
          <div
            key={group}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
              signed ? "border-green-500/30 bg-green-500/10" : "border-border/50 bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{g.emoji}</span>
              <span className="font-medium">{g.label}</span>
              {signed ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Clock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {sigData ? (
                <>
                  <span className="font-medium text-foreground">{sigData.signer_name}</span>
                  {sigData.signed_at && (
                    <span className="ml-2">
                      {format(new Date(sigData.signed_at), "HH:mm dd/MM", { locale: vi })}
                    </span>
                  )}
                </>
              ) : (
                <span>Chưa ký</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RequestCard({
  request,
  onSign,
  isSigning,
  myGroup,
  showSignButton,
  signDisabled,
  isSelected,
  onToggleSelect,
}: {
  request: MultisigMintRequest;
  onSign: (r: MultisigMintRequest) => void;
  isSigning: boolean;
  myGroup: GovGroupName | null;
  showSignButton: boolean;
  signDisabled?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  // Count only valid unique groups from SIGNATURE_ORDER to avoid duplicates (e.g. WILL vs will)
  const completedCount = SIGNATURE_ORDER.filter((g) =>
    (request.multisig_completed_groups || []).includes(g)
  ).length;
  const isFullySigned = completedCount >= REQUIRED_SIGNATURES;

  return (
    <Card className={`border-border/50 ${isSelected ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onToggleSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(request.id)}
              />
            )}
            <div className="flex items-center gap-2">
              <Avatar className="w-10 h-10 border border-border/50">
                {request.actor_avatar_url ? (
                  <AvatarImage 
                    src={request.actor_avatar_url} 
                    alt={request.actor_display_name || ''} 
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                  {(request.actor_display_name || '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
              {request.actor_display_name && (
                <p className="text-sm font-semibold text-foreground">
                  {request.actor_display_name}
                </p>
              )}
              <p className="font-mono text-xs text-muted-foreground">
                {request.id.slice(0, 8)}...
              </p>
              <p className="text-lg font-bold">{request.amount.toLocaleString()} FUN</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isFullySigned ? (
              <Badge className="bg-green-600 text-white">
                <Sparkles className="w-3 h-3 mr-1" /> Sẵn sàng mint
              </Badge>
            ) : completedCount === 2 ? (
              <Badge className="bg-amber-500 text-white animate-pulse">
                ⚡ {completedCount}/{REQUIRED_SIGNATURES} — Cần 1 chữ ký nữa!
              </Badge>
            ) : (
              <Badge variant="secondary">
                {completedCount}/{REQUIRED_SIGNATURES} chữ ký
              </Badge>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Ví nhận: {request.recipient_address.slice(0, 10)}...{request.recipient_address.slice(-6)}</p>
          <p>Nonce: {request.nonce}</p>
          <p>
            Tạo:{" "}
            {formatDistanceToNow(new Date(request.created_at), {
              addSuffix: true,
              locale: vi,
            })}
          </p>
        </div>

        <SignatureStatus request={request} />

        {showSignButton && (
          <Button
            onClick={() => onSign(request)}
            disabled={isSigning || signDisabled}
            className="w-full"
            size="sm"
          >
            {isSigning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang ký...
              </>
            ) : signDisabled ? (
              <>
                <Shield className="w-4 h-4 mr-2" /> Cần kết nối đúng ví để ký
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" /> Ký xác nhận
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function AttesterPanel() {
  const navigate = useNavigate();
  const {
    isAttester,
    myGroup,
    myName,
    isConnected,
    effectiveAddress,
    pendingRequests,
    signedRequests,
    allRequests,
    error,
    canSign,
    isLoading,
    isSigning,
    batchProgress,
    signRequest,
    signBatchRequests,
    refreshRequests,
    debugInfo,
  } = useAttesterSigning();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDebug, setShowDebug] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = pendingRequests.length > 0 && pendingRequests.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map((r) => r.id)));
    }
  };

  const selectedRequests = useMemo(
    () => pendingRequests.filter((r) => selectedIds.has(r.id)),
    [pendingRequests, selectedIds]
  );

  // canSign already accounts for saved wallet + MetaMask available
  const canSignWithConnectedWallet = canSign;

  const handleBatchSign = () => {
    if (selectedRequests.length === 0) return;
    signBatchRequests(selectedRequests);
    setSelectedIds(new Set());
  };

  if (!isAttester) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container max-w-2xl py-8 space-y-4">
          <Alert variant={effectiveAddress ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {effectiveAddress ? (
                <>Ví <code className="text-xs">{effectiveAddress}</code> không phải GOV Attester.</>
              ) : (
                "Vui lòng kết nối ví MetaMask hoặc đăng nhập tài khoản đã lưu ví GOV Attester để truy cập Attester Panel."
              )}
            </AlertDescription>
          </Alert>

          {/* Debug info for troubleshooting */}
          <Card className="border-border/30 bg-muted/20">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Info className="w-4 h-4" /> Thông tin chẩn đoán
              </p>
              <div className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3 text-xs">
                <span className="text-muted-foreground">Ví đã lưu (DB):</span>
                <code className="text-foreground break-all">{debugInfo.savedAddress || "Chưa lưu ví"}</code>

                <span className="text-muted-foreground">Nhóm từ ví lưu:</span>
                <span className={debugInfo.savedAttesterGroup ? "text-green-500" : "text-destructive"}>
                  {debugInfo.savedAttesterGroup
                    ? GOV_GROUPS[debugInfo.savedAttesterGroup as GovGroupName]?.label
                    : "Không thuộc GOV"}
                </span>

                <span className="text-muted-foreground">MetaMask:</span>
                <span>
                  {debugInfo.web3ContextConnected ? "Đã kết nối" : "Chưa kết nối"}
                  {debugInfo.web3ContextAddress && (
                    <code className="ml-2">{debugInfo.web3ContextAddress}</code>
                  )}
                </span>

                <span className="text-muted-foreground">Ví live detect:</span>
                <code className="text-foreground break-all">{debugInfo.detectedWalletAddress || "—"}</code>

                <span className="text-muted-foreground">Providers:</span>
                <span>{debugInfo.providersFound} wallet provider(s)</span>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const groupInfo = myGroup ? GOV_GROUPS[myGroup] : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container max-w-3xl py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => smartBack(navigate)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6" /> Attester Panel
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {groupInfo?.emoji} Nhóm{" "}
                <strong>{groupInfo?.label}</strong> — {myName}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refreshRequests} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>

        {/* Wallet & Group Diagnostic */}
        <Card className="border-border/30 bg-muted/20">
          <CardContent className="p-0">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                Chẩn đoán ví & nhóm GOV
              </span>
              {showDebug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showDebug && (
              <div className="px-4 pb-4 space-y-2 text-xs border-t border-border/30 pt-3">
                <div className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3">
                  <span className="text-muted-foreground font-medium">Nhóm phát hiện:</span>
                  <span className={debugInfo.detectedGroup ? "text-green-500 font-semibold" : "text-destructive font-semibold"}>
                    {debugInfo.detectedGroup
                      ? `${GOV_GROUPS[debugInfo.detectedGroup as GovGroupName]?.emoji} ${GOV_GROUPS[debugInfo.detectedGroup as GovGroupName]?.label} (${debugInfo.detectedGroup})`
                      : "❌ Không phát hiện được nhóm"}
                  </span>

                  <span className="text-muted-foreground font-medium">Ví hiệu lực:</span>
                  <code className="text-foreground break-all">{debugInfo.effectiveAddress || "—"}</code>

                  <span className="text-muted-foreground font-medium">Ví đã lưu (DB):</span>
                  <span>
                    <code className="text-foreground break-all">{debugInfo.savedAddress || "—"}</code>
                    {debugInfo.savedAttesterGroup && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {GOV_GROUPS[debugInfo.savedAttesterGroup as GovGroupName]?.label}
                      </Badge>
                    )}
                  </span>

                  <span className="text-muted-foreground font-medium">Web3 (MetaMask):</span>
                  <span>
                    {debugInfo.web3ContextConnected ? (
                      <Badge className="bg-green-600 text-white text-[10px]">Đã kết nối</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Chưa kết nối</Badge>
                    )}
                    {debugInfo.web3ContextAddress && (
                      <code className="ml-2 text-foreground break-all">{debugInfo.web3ContextAddress}</code>
                    )}
                  </span>

                  <span className="text-muted-foreground font-medium">Ví live detect:</span>
                  <code className="text-foreground break-all">{debugInfo.detectedWalletAddress || "—"}</code>

                  <span className="text-muted-foreground font-medium">Ví GOV live:</span>
                  <span>
                    <code className="text-foreground break-all">{debugInfo.liveGovAddress || "—"}</code>
                    {debugInfo.connectedAttesterGroup && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {GOV_GROUPS[debugInfo.connectedAttesterGroup as GovGroupName]?.label}
                      </Badge>
                    )}
                  </span>

                  <span className="text-muted-foreground font-medium">Ví ký lệnh:</span>
                  <code className="text-foreground break-all">{debugInfo.signingAddress || "—"}</code>

                  <span className="text-muted-foreground font-medium">Providers:</span>
                  <span className="text-foreground">{debugInfo.providersFound} wallet provider(s)</span>

                  <span className="text-muted-foreground font-medium">Có thể ký:</span>
                  <span className={canSign ? "text-green-500 font-semibold" : "text-amber-500 font-semibold"}>
                    {canSign ? "✅ Có" : "⚠️ Không — cần kết nối MetaMask đúng ví GOV"}
                  </span>
                </div>

                {!debugInfo.savedAddress && !debugInfo.detectedGroup && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertCircle className="h-3 w-3" />
                    <AlertDescription className="text-xs">
                      Không tìm thấy ví GOV. Hãy đăng nhập bằng tài khoản đã liên kết ví GOV Attester, hoặc kết nối MetaMask với ví GOV.
                    </AlertDescription>
                  </Alert>
                )}

                {debugInfo.savedAddress && !debugInfo.savedAttesterGroup && (
                  <Alert className="mt-3">
                    <AlertCircle className="h-3 w-3" />
                    <AlertDescription className="text-xs">
                      Ví đã lưu <code>{debugInfo.savedAddress?.slice(0,10)}...</code> không nằm trong danh sách GOV Attester. Liên hệ admin để kiểm tra.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          <>
            {!isConnected && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Đang xem bằng ví GOV đã lưu. Kết nối MetaMask đúng ví <code className="text-xs">{effectiveAddress}</code> để ký lệnh.
                </AlertDescription>
              </Alert>
            )}

            {isConnected && !canSign && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Đang xem bằng ví GOV đã lưu <code className="text-xs">{effectiveAddress}</code>. Ví MetaMask hiện tại chưa đúng nhóm {groupInfo?.label}, nên chỉ xem được lệnh và chưa thể ký.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Không đọc được danh sách lệnh ký: {error instanceof Error ? error.message : "Lỗi không xác định"}
                </AlertDescription>
              </Alert>
            )}

            {/* Batch progress */}
            {batchProgress && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang ký hàng loạt...
                    </span>
                    <span>{batchProgress.current}/{batchProgress.total}</span>
                  </div>
                  <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
                </CardContent>
              </Card>
            )}

            {/* Section: Cần ký */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Cần ký ({pendingRequests.length})
                </h2>
                {pendingRequests.length > 0 && canSignWithConnectedWallet && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                      Chọn tất cả
                    </label>
                    {selectedIds.size > 0 && (
                      <Button
                        onClick={handleBatchSign}
                        disabled={isSigning}
                        size="sm"
                        className="gap-1"
                      >
                        <CheckSquare className="w-4 h-4" />
                        Ký tất cả ({selectedIds.size})
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {pendingRequests.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Không có yêu cầu nào cần ký</p>
                    {allRequests.length > 0 && (
                      <p className="text-xs mt-1">Đã đọc {allRequests.length} lệnh, nhưng nhóm {groupInfo?.label} không còn lệnh chờ ký.</p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                pendingRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    onSign={signRequest}
                    isSigning={isSigning}
                    myGroup={myGroup}
                    showSignButton={true}
                    signDisabled={!canSignWithConnectedWallet}
                    isSelected={selectedIds.has(req.id)}
                    onToggleSelect={canSignWithConnectedWallet ? toggleSelect : undefined}
                  />
                ))
              )}
            </section>

            {/* Section: Đã ký */}
            {signedRequests.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Đã ký ({signedRequests.length})
                </h2>
                {signedRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    onSign={signRequest}
                    isSigning={isSigning}
                    myGroup={myGroup}
                    showSignButton={false}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
