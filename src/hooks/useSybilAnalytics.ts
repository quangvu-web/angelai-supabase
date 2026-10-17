import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RiskyDid {
  did_id: string;
  did: string;
  display_name: string;
  trust_tier: string;
  sybil_risk: string;
  risk_score: number;
  risk_band: "low" | "medium" | "high" | "critical";
  flags_open: number;
  flags_total: number;
}

export interface GraphNode {
  did_id: string;
  did: string;
  label: string;
  trust_tier: string;
  sybil_risk: string;
  flags_open: number;
  is_seed: boolean;
}
export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
  reciprocal: boolean;
  last_at: string;
}
export interface TrustGraph {
  seed_did: string;
  days: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SybilCluster {
  cluster_key: string;
  member_count: number;
  edge_count: number;
  reciprocal_ratio: number;
  avg_risk: number;
  member_dids: Array<{
    did_id: string;
    did: string;
    display_name: string;
    sybil_risk: string;
    trust_tier: string;
  }>;
}

export function useTopRiskyDids(limit = 50) {
  return useQuery({
    queryKey: ["top-risky-dids", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_risky_dids", { _limit: limit });
      if (error) throw error;
      return (data || []) as RiskyDid[];
    },
    refetchInterval: 60_000,
  });
}

export function useDidRiskScore(didId: string | undefined) {
  return useQuery({
    queryKey: ["did-risk-score", didId],
    queryFn: async () => {
      if (!didId) return null;
      const { data, error } = await supabase.rpc("get_did_risk_score", { _did_id: didId });
      if (error) throw error;
      return data as any;
    },
    enabled: !!didId,
  });
}

export function useTrustGraph(seedDid: string | undefined, days = 30, maxEdges = 200) {
  return useQuery({
    queryKey: ["trust-graph", seedDid, days, maxEdges],
    queryFn: async () => {
      if (!seedDid) return null;
      const { data, error } = await supabase.rpc("get_trust_graph", {
        _seed_did: seedDid, _days: days, _max_edges: maxEdges,
      });
      if (error) throw error;
      return data as unknown as TrustGraph;
    },
    enabled: !!seedDid,
  });
}

export function useSybilClusters(days = 14, minSize = 3, limit = 20) {
  return useQuery({
    queryKey: ["sybil-clusters", days, minSize, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("detect_sybil_clusters", {
        _days: days, _min_size: minSize, _limit: limit,
      });
      if (error) throw error;
      return (data || []) as SybilCluster[];
    },
    refetchInterval: 90_000,
  });
}
