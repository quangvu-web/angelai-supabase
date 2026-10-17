import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SBTType =
  | "identity"
  | "trust"
  | "contribution"
  | "credential"
  | "milestone"
  | "legacy";

export interface SBT {
  id: string;
  token_id: string;
  did_id: string;
  user_id: string;
  sbt_type: SBTType;
  sbt_subtype: string;
  issuer: string;
  status: "active" | "frozen" | "revoked" | "archived";
  trust_weight: number;
  privacy_level: "public" | "permissioned" | "private";
  metadata: any;
  issued_at: string;
  expires_at: string | null;
}

export function useSBTs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["sbts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("sbt_registry")
        .select("*")
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SBT[];
    },
    enabled: !!user?.id,
  });
}
