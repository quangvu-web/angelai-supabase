import { useState } from "react";
import { SybilHeatmapPanel } from "./SybilHeatmapPanel";
import { TrustGraphView } from "./TrustGraphView";
import { SybilClustersPanel } from "./SybilClustersPanel";
import type { RiskyDid } from "@/hooks/useSybilAnalytics";

export function SybilAnalyticsPanel() {
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SybilHeatmapPanel
          onSelectDid={(r: RiskyDid) => setSelected({ id: r.did_id, label: r.display_name })}
        />
        <TrustGraphView seedDid={selected?.id} seedLabel={selected?.label} />
      </div>
      <SybilClustersPanel
        onInspect={(id, label) => setSelected({ id, label })}
      />
    </div>
  );
}
