import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTopRiskyDids, type RiskyDid } from "@/hooks/useSybilAnalytics";
import { Flame, Network } from "lucide-react";

interface Props {
  onSelectDid?: (did: RiskyDid) => void;
}

const BAND_CLASSES: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-400 text-amber-950",
  low: "bg-muted text-muted-foreground",
};

export function SybilHeatmapPanel({ onSelectDid }: Props) {
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useTopRiskyDids(80);
  const filtered = data.filter(
    (r) =>
      !search ||
      r.display_name.toLowerCase().includes(search.toLowerCase()) ||
      r.did.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" /> Sybil Risk Heatmap
        </CardTitle>
        <Input
          placeholder="Tìm theo DID hoặc tên…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-2"
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Không có DID rủi ro — hệ sinh thái đang sạch ✨
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {filtered.map((r) => (
              <button
                key={r.did_id}
                onClick={() => onSelectDid?.(r)}
                className={`text-left rounded-md p-2 hover:scale-[1.02] transition-transform ${BAND_CLASSES[r.risk_band] || BAND_CLASSES.low}`}
                title={`${r.display_name}\nRisk ${r.risk_score} (${r.risk_band})\nFlags open: ${r.flags_open}`}
              >
                <div className="text-xs font-semibold truncate">{r.display_name}</div>
                <div className="text-[10px] opacity-80 truncate">{r.did}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-mono">{r.risk_score}</span>
                  <span className="text-[10px]">{r.trust_tier}</span>
                </div>
                {r.flags_open > 0 && (
                  <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0">
                    {r.flags_open} flag mở
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <Legend color="bg-destructive" label="critical ≥75" />
          <Legend color="bg-orange-500" label="high ≥50" />
          <Legend color="bg-amber-400" label="medium ≥25" />
          <Legend color="bg-muted" label="low" />
          <span className="ml-auto inline-flex items-center gap-1">
            <Network className="h-3 w-3" /> Click ô để xem graph
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
