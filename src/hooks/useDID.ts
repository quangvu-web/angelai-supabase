import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DIDRecord {
  id: string;
  did: string;
  did_hash: string;
  wallet_address: string | null;
  entity_type: string;
  did_level: number;
  verification_state: any;
  status: string;
  created_at: string;
}

export function useDID() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-did", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_dids")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as DIDRecord | null;
    },
    enabled: !!user?.id,
  });
}
