import { useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrustGraph, type GraphEdge, type GraphNode } from "@/hooks/useSybilAnalytics";
import { Network } from "lucide-react";

interface Props {
  seedDid?: string;
  seedLabel?: string;
  days?: number;
}

const RISK_COLORS: Record<string, string> = {
  critical: "hsl(var(--destructive))",
  high: "hsl(25 95% 53%)",
  medium: "hsl(38 92% 50%)",
  low: "hsl(var(--muted-foreground))",
};

/** Simple deterministic radial layout (no extra deps). */
function layoutNodes(nodes: GraphNode[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const seedIdx = nodes.findIndex((n) => n.is_seed);
  const radius = Math.min(width, height) * 0.38;
  const positions = new Map<string, { x: number; y: number }>();
  const others = nodes.filter((_, i) => i !== seedIdx);
  if (seedIdx >= 0) positions.set(nodes[seedIdx].did_id, { x: cx, y: cy });
  others.forEach((n, i) => {
    const angle = (i / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2;
    positions.set(n.did_id, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  });
  return positions;
}

export function TrustGraphView({ seedDid, seedLabel, days = 30 }: Props) {
  const { data, isLoading } = useTrustGraph(seedDid, days, 120);
  const containerRef = useRef<HTMLDivElement>(null);

  const dims = { w: 560, h: 360 };
  const positions = useMemo(() => {
    if (!data?.nodes?.length) return new Map();
    return layoutNodes(data.nodes, dims.w, dims.h);
  }, [data, dims.w, dims.h]);

  if (!seedDid) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Chọn 1 DID trong heatmap để xem đồ thị tin cậy
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="h-4 w-4" /> Trust Graph — {seedLabel || seedDid.slice(0, 12)}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {data?.nodes?.length || 0} nodes · {data?.edges?.length || 0} edges · {days} ngày
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[360px] w-full" />
        ) : !data || data.nodes.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">
            Không có liên kết attestation trong {days} ngày qua.
          </div>
        ) : (
          <div ref={containerRef} className="overflow-x-auto">
            <svg width={dims.w} height={dims.h} className="mx-auto block">
              {/* Edges */}
              {data.edges.map((e: GraphEdge, i) => {
                const a = positions.get(e.from);
                const b = positions.get(e.to);
                if (!a || !b) return null;
                const stroke = e.reciprocal ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";
                const sw = Math.min(4, 1 + e.weight * 0.6);
                return (
                  <line
                    key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={stroke}
                    strokeOpacity={e.reciprocal ? 0.7 : 0.35}
                    strokeWidth={sw}
                    strokeDasharray={e.reciprocal ? "4 2" : undefined}
                  />
                );
              })}
              {/* Nodes */}
              {data.nodes.map((n: GraphNode) => {
                const p = positions.get(n.did_id);
                if (!p) return null;
                const r = n.is_seed ? 12 : 8;
                const color = RISK_COLORS[n.sybil_risk] || RISK_COLORS.low;
                return (
                  <g key={n.did_id}>
                    <circle
                      cx={p.x} cy={p.y} r={r}
                      fill={color}
                      stroke={n.is_seed ? "hsl(var(--primary))" : "hsl(var(--background))"}
                      strokeWidth={n.is_seed ? 3 : 1.5}
                    />
                    {n.flags_open > 0 && (
                      <circle cx={p.x + r * 0.7} cy={p.y - r * 0.7} r={4}
                        fill="hsl(var(--destructive))" stroke="hsl(var(--background))" strokeWidth={1} />
                    )}
                    <text
                      x={p.x} y={p.y + r + 11}
                      textAnchor="middle"
                      fontSize="10"
                      fill="hsl(var(--foreground))"
                      className="pointer-events-none"
                    >
                      {(n.label || n.did).slice(0, 14)}
                    </text>
                    <title>{`${n.label}\nDID: ${n.did}\nTier: ${n.trust_tier}\nRisk: ${n.sybil_risk}\nFlags open: ${n.flags_open}`}</title>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: RISK_COLORS.critical }} /> critical
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: RISK_COLORS.high }} /> high
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: RISK_COLORS.medium }} /> medium
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: RISK_COLORS.low }} /> low
          </span>
          <span className="ml-auto">— Đường đứt đỏ = reciprocal A↔B</span>
        </div>
      </CardContent>
    </Card>
  );
}
