import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownLeft, ArrowUpRight, X, ShieldCheck, Inbox, Send } from "lucide-react";
import {
  useAttestations, useRevokeAttestation,
  ATTESTATION_LABELS, type AttestationRow, type AttestationType,
} from "@/hooks/useAttestations";
import { AttestationDialog } from "./AttestationDialog";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRealtimeChannelId } from "@/lib/realtime";

interface Props {
  didId: string;
  trustTier: string | null | undefined;
}

export function AttestationsTab({ didId, trustTier }: Props) {
  const { data: items, isLoading } = useAttestations(didId);
  const revokeMut = useRevokeAttestation();
  const qc = useQueryClient();

  // Realtime: notify on new received attestation
  useEffect(() => {
    if (!didId) return;
    const channel = supabase
      .channel(createRealtimeChannelId(`attest-${didId.slice(0, 8)}`))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attestation_log",
          filter: `to_did=eq.${didId}`,
        },
        () => {
          toast.success("✨ Bạn vừa nhận attestation mới!");
          qc.invalidateQueries({ queryKey: ["attestations", didId] });
          qc.invalidateQueries({ queryKey: ["trust-profile"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [didId, qc]);

  const received = (items ?? []).filter((i) => i.direction === "received");
  const sent = (items ?? []).filter((i) => i.direction === "sent");
  const totalWeight = received
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + Number(r.weight ?? 0), 0);

  const canSend = trustTier && trustTier !== "T0";

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" /> Attestation P2P
            </CardTitle>
            {canSend ? (
              <AttestationDialog />
            ) : (
              <Badge variant="outline" className="text-xs">Cần T1+ để gửi</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Nhận" value={received.length} />
          <Stat label="Gửi" value={sent.length} />
          <Stat label="Trust Weight" value={`+${totalWeight.toFixed(3)}`} />
        </CardContent>
      </Card>

      <Tabs defaultValue="received">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="received">
            <Inbox className="h-4 w-4 mr-1" /> Đã nhận ({received.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Send className="h-4 w-4 mr-1" /> Đã gửi ({sent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-2 mt-3">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {!isLoading && received.length === 0 && <EmptyState text="Chưa có ai gửi attestation cho bạn" />}
          {received.map((a) => (
            <AttestationItem key={a.id} a={a} />
          ))}
        </TabsContent>

        <TabsContent value="sent" className="space-y-2 mt-3">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {!isLoading && sent.length === 0 && <EmptyState text="Bạn chưa gửi attestation nào" />}
          {sent.map((a) => (
            <AttestationItem
              key={a.id}
              a={a}
              onRevoke={a.status === "active" ? () => revokeMut.mutate(a.id) : undefined}
              revoking={revokeMut.isPending}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{text}</CardContent></Card>
  );
}

function AttestationItem({
  a, onRevoke, revoking,
}: { a: AttestationRow; onRevoke?: () => void; revoking?: boolean }) {
  const meta = ATTESTATION_LABELS[a.attestation_type as AttestationType];
  const note = a.evidence?.note as string | undefined;

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {a.direction === "received" ? (
              <ArrowDownLeft className="h-4 w-4 mt-1 text-emerald-500 shrink-0" />
            ) : (
              <ArrowUpRight className="h-4 w-4 mt-1 text-blue-500 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`${meta?.color || ""} text-xs`}>
                  {meta?.label || a.attestation_type}
                </Badge>
                {a.status === "revoked" && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Đã rút</Badge>
                )}
                {a.status === "active" && (
                  <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                    +{Number(a.weight).toFixed(3)}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {a.direction === "received" ? "Từ: " : "Đến: "}
                <span className="font-mono">{a.counterparty_label}</span>
              </div>
              {note && (
                <div className="text-xs mt-1 italic text-muted-foreground line-clamp-2">"{note}"</div>
              )}
              <div className="text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: vi })}
              </div>
            </div>
          </div>
          {onRevoke && (
            <Button size="sm" variant="ghost" onClick={onRevoke} disabled={revoking}
              className="h-7 px-2 text-muted-foreground hover:text-destructive">
              <X className="h-3 w-3 mr-1" /> Rút
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
