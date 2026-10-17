import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSybilClusters, type SybilCluster } from "@/hooks/useSybilAnalytics";
import { Users, AlertTriangle, ChevronRight } from "lucide-react";

interface Props {
  onInspect?: (didId: string, label: string) => void;
}

export function SybilClustersPanel({ onInspect }: Props) {
  const [days, setDays] = useState(14);
  const [minSize, setMinSize] = useState(3);
  const { data = [], isLoading } = useSybilClusters(days, minSize, 30);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Sybil Clusters (mutual-attestation triangles)
        </CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 ngày</SelectItem>
              <SelectItem value="14">14 ngày</SelectItem>
              <SelectItem value="30">30 ngày</SelectItem>
              <SelectItem value="60">60 ngày</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(minSize)} onValueChange={(v) => setMinSize(Number(v))}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">≥ 3 thành viên</SelectItem>
              <SelectItem value="4">≥ 4 thành viên</SelectItem>
              <SelectItem value="5">≥ 5 thành viên</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : data.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Không phát hiện cluster nào trong {days} ngày qua ✨
          </div>
        ) : (
          data.map((c: SybilCluster) => (
            <div key={c.cluster_key} className="border rounded-md p-3 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={c.avg_risk >= 60 ? "destructive" : c.avg_risk >= 30 ? "secondary" : "outline"}>
                  Risk {c.avg_risk}
                </Badge>
                <Badge variant="outline">{c.member_count} thành viên</Badge>
                <Badge variant="outline">{c.edge_count} edges</Badge>
                <Badge variant="outline">recip {(c.reciprocal_ratio * 100).toFixed(0)}%</Badge>
                {c.avg_risk >= 60 && (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive ml-auto">
                    <AlertTriangle className="h-3 w-3" /> Cao
                  </span>
                )}
              </div>
              <div className="mt-2 grid gap-1">
                {c.member_dids.map((m) => (
                  <button
                    key={m.did_id}
                    onClick={() => onInspect?.(m.did_id, m.display_name)}
                    className="flex items-center justify-between text-left text-xs px-2 py-1 rounded hover:bg-muted"
                  >
                    <span className="truncate">
                      <span className="font-medium">{m.display_name}</span>
                      <span className="text-muted-foreground ml-2 font-mono">{m.did.slice(0, 24)}…</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{m.trust_tier}</Badge>
                      <Badge
                        variant={m.sybil_risk === "critical" || m.sybil_risk === "high" ? "destructive" : "outline"}
                        className="text-[10px] px-1 py-0"
                      >
                        {m.sybil_risk}
                      </Badge>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
