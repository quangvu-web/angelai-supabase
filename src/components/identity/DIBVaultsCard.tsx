import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  IdCard,
  ShieldCheck,
  Award,
  HandHeart,
  GraduationCap,
  Vote,
  Coins,
  Copy,
  RefreshCw,
  Lock,
  Hash,
} from "lucide-react";
import { useDIB, useRecomputeDIB } from "@/hooks/useDIB";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface VaultDef {
  key: keyof Pick<
    NonNullable<ReturnType<typeof useDIB>["data"]>,
    | "identity_vault_hash"
    | "trust_vault_hash"
    | "reputation_vault_hash"
    | "contribution_vault_hash"
    | "credential_vault_hash"
    | "governance_vault_hash"
    | "economic_access_hash"
  >;
  label: string;
  description: string;
  icon: typeof IdCard;
  gradient: string;
}

const VAULTS: VaultDef[] = [
  {
    key: "identity_vault_hash",
    label: "Identity Vault",
    description: "DID gốc, ví liên kết, lịch sử xác minh, phương thức khôi phục",
    icon: IdCard,
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    key: "trust_vault_hash",
    label: "Trust Vault",
    description: "TC, trust tier, sybil/fraud audit trail, attestations",
    icon: ShieldCheck,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    key: "reputation_vault_hash",
    label: "Reputation Vault",
    description: "SBT collection, role badges, peer validations",
    icon: Award,
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    key: "contribution_vault_hash",
    label: "Contribution Vault",
    description: "VVU history, snapshots PLS/NLS/LLS, đóng góp đã xác minh",
    icon: HandHeart,
    gradient: "from-pink-500 to-rose-500",
  },
  {
    key: "credential_vault_hash",
    label: "Credential Vault",
    description: "Chứng chỉ học tập, license, kỹ năng đã xác minh",
    icon: GraduationCap,
    gradient: "from-purple-500 to-violet-500",
  },
  {
    key: "governance_vault_hash",
    label: "Governance Vault",
    description: "Lịch sử bỏ phiếu/đề xuất, độ tin cậy phê duyệt",
    icon: Vote,
    gradient: "from-cyan-500 to-sky-500",
  },
  {
    key: "economic_access_hash",
    label: "Economic Access Vault",
    description: "Quyền mint, reward tier, activation, treasury rights",
    icon: Coins,
    gradient: "from-orange-500 to-red-500",
  },
];

interface Props {
  didId: string;
}

export function DIBVaultsCard({ didId }: Props) {
  const { data: dib, isLoading } = useDIB(didId);
  const recompute = useRecomputeDIB();
  const [showFull, setShowFull] = useState<Record<string, boolean>>({});

  const copy = (label: string, value?: string | null) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`Đã copy ${label}`);
  };

  const truncate = (h: string | null | undefined) =>
    h ? `${h.slice(0, 10)}…${h.slice(-8)}` : "—";

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      {/* Snapshot Root Header */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-yellow-500/5 to-amber-400/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-600" />
                Digital Identity Bank
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                7 vault danh tiếng — neo bằng SHA-256, sẵn sàng cho audit / dispute
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => recompute.mutate(didId)}
              disabled={recompute.isPending}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${recompute.isPending ? "animate-spin" : ""}`}
              />
              {recompute.isPending ? "Đang tính..." : "Làm mới"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Hash className="h-3 w-3" /> Snapshot Root Hash
              </div>
              <code className="text-xs font-mono break-all block">
                {dib?.snapshot_root_hash
                  ? showFull.root
                    ? dib.snapshot_root_hash
                    : truncate(dib.snapshot_root_hash)
                  : "Chưa có — bấm Làm mới"}
              </code>
            </div>
            {dib?.snapshot_root_hash && (
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => setShowFull((s) => ({ ...s, root: !s.root }))}
                >
                  {showFull.root ? "Rút gọn" : "Xem đầy đủ"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => copy("snapshot root", dib.snapshot_root_hash)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {dib?.last_snapshot_at && (
            <p className="text-xs text-muted-foreground">
              Cập nhật{" "}
              {formatDistanceToNow(new Date(dib.last_snapshot_at), {
                addSuffix: true,
                locale: vi,
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 7 Vault Cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {VAULTS.map((v) => {
          const hash = dib?.[v.key] as string | null | undefined;
          const Icon = v.icon;
          const isShown = showFull[v.key];
          return (
            <Card key={v.key} className="overflow-hidden">
              <div className={`h-1 bg-gradient-to-r ${v.gradient}`} />
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-lg p-2 bg-gradient-to-br ${v.gradient} text-white shrink-0`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm">{v.label}</h4>
                      {hash ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        >
                          Sealed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-4">
                          Empty
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {v.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                  <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                  <code className="text-[11px] font-mono flex-1 break-all">
                    {hash ? (isShown ? hash : truncate(hash)) : "—"}
                  </code>
                  {hash && (
                    <div className="flex gap-0.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                          setShowFull((s) => ({ ...s, [v.key]: !s[v.key] }))
                        }
                        title={isShown ? "Rút gọn" : "Xem đầy đủ"}
                      >
                        {isShown ? "−" : "+"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => copy(v.label, hash)}
                        title="Copy"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Privacy notice */}
      <Card className="border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1.5">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Lock className="h-3.5 w-3.5" /> Quyền riêng tư
          </p>
          <p>
            • Vault chỉ lưu <b>hash SHA-256</b> — không lộ dữ liệu thô (KYC, email, hành vi).
          </p>
          <p>
            • Snapshot Root được dùng cho audit, dispute resolution, governance fairness.
          </p>
          <p>
            • Phase 3 sẽ mở Merkle proof + ZK attestation để chứng minh quyền mà không lộ dữ liệu.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
