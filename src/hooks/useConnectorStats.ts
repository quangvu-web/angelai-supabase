import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ConnectorRecord {
  id: string;
  newcomer_user_id: string;
  newcomer_did: string | null;
  connector_user_id: string | null;
  connector_wallet: string;
  tx_hash: string;
  chain_id: number;
  token_symbol: string;
  token_amount: number;
  block_number: number;
  tx_index: number;
  detected_at: string;
  confirmed_at: string | null;
  status: "pending" | "confirmed" | "revoked";
  revoke_reason: string | null;
  evidence_hash: string | null;
}

export interface ConnectorProfileLite {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
}

export interface ConnectorStats {
  profile: {
    connector_count: number;
    has_connector: boolean;
    connector_window_expires_at: string | null;
    created_at: string;
  } | null;
  my_connector: ConnectorRecord | null;
  my_connector_profile: ConnectorProfileLite | null;
  connectees: Array<{
    id: string;
    newcomer_user_id: string;
    tx_hash: string;
    token_symbol: string;
    token_amount: number;
    confirmed_at: string | null;
    status: string;
  }>;
  connectee_profiles: ConnectorProfileLite[];
}

export function useConnectorStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["connector-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ConnectorStats | null> => {
      const { data, error } = await supabase.functions.invoke("connector-stats");
      if (error) throw error;
      return data as ConnectorStats;
    },
    staleTime: 60_000,
  });
}
