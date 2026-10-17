import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

type DisputeStatus = "open" | "upheld" | "rejected";

interface DisputeRow {
  id: string;
  status: DisputeStatus;
  reason: string;
  raised_by: string;
  created_at: string;
  resolved_at: string | null;
  evidence: any;
  connector_id: string;
  connectors: {
    id: string;
    newcomer_user_id: string;
    connector_user_id: string | null;
    connector_wallet: string;
    tx_hash: string;
    chain_id: number;
    token_symbol: string;
    token_amount: number;
    status: string;
  } | null;
}

function bscScanUrl(txHash: string, chainId: number) {
  return chainId === 97
    ? `https://testnet.bscscan.com/tx/${txHash}`
    : `https://bscscan.com/tx/${txHash}`;
}

export function ConnectorDisputesPanel() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<DisputeStatus>("open");
  const [revokeReasons, setRevokeReasons] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-connector-disputes", statusFilter],
    queryFn: async (): Promise<DisputeRow[]> => {
      const { data, error } = await supabase.functions.invoke("connector-dispute", {
        body: { action: "list", status: statusFilter },
      });
      if (error) throw error;
      return (data?.disputes ?? []) as DisputeRow[];
    },
  });

  const resolve = useMutation({
    mutationFn: async (args: { dispute_id: string; status: "upheld" | "rejected"; revoke_reason?: string }) => {
      const { data, error } = await supabase.functions.invoke("connector-dispute", {
        body: { action: "resolve", ...args },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "upheld" ? "Đã upheld + revoke" : "Đã reject");
      qc.invalidateQueries({ queryKey: ["admin-connector-disputes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Lỗi resolve"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-[#daa520]" />
          Connector Disputes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as DisputeStatus)}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="upheld">Upheld</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="mt-4 space-y-3">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !data || data.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Không có dispute trong nhóm "{statusFilter}".
              </p>
            ) : (
              data.map((d) => {
                const c = d.connectors;
                const reasonInput = revokeReasons[d.id] ?? "dispute_upheld";
                return (
                  <Card key={d.id} className="border-muted">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={d.status === "open" ? "default" : "secondary"}>
                              {d.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: vi })}
                            </span>
                          </div>
                          <p className="text-sm font-medium break-words">{d.reason}</p>
                        </div>
                        {c && (
                          <a
                            href={bscScanUrl(c.tx_hash, c.chain_id)}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-[#daa520] hover:underline flex items-center gap-1 shrink-0"
                          >
                            BscScan <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {c && (
                        <div className="grid gap-2 md:grid-cols-2 text-xs bg-muted/40 rounded p-2 font-mono">
                          <div>
                            <div className="text-muted-foreground">Newcomer</div>
                            <div className="truncate">{c.newcomer_user_id}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Connector wallet</div>
                            <div className="truncate">{c.connector_wallet}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Token</div>
                            <div>{c.token_amount} {c.token_symbol}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Connector status</div>
                            <div>{c.status}</div>
                          </div>
                        </div>
                      )}

                      {d.status === "open" && (
                        <div className="flex flex-col md:flex-row gap-2">
                          <Input
                            placeholder="Lý do revoke (nếu upheld)"
                            value={reasonInput}
                            onChange={(e) => setRevokeReasons((p) => ({ ...p, [d.id]: e.target.value }))}
                            className="md:flex-1"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={resolve.isPending}
                              onClick={() =>
                                resolve.mutate({
                                  dispute_id: d.id,
                                  status: "upheld",
                                  revoke_reason: reasonInput,
                                })
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Upheld
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resolve.isPending}
                              onClick={() =>
                                resolve.mutate({ dispute_id: d.id, status: "rejected" })
                              }
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
