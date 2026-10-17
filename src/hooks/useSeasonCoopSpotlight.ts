import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoopTeamRow {
  team_id: string;
  team_name: string;
  solved_total: number;
  member_count: number;
}
export interface CoopContributorRow {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  contributions: number;
  teams_helped: number;
}
export interface CoopConnectedRow {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  teams_joined: number;
}
export interface CoopSpotlightPayload {
  active: boolean;
  season?: { id: string; code: string; name: string };
  window_start?: string;
  window_end?: string;
  top_teams?: CoopTeamRow[];
  top_contributors?: CoopContributorRow[];
  most_connected?: CoopConnectedRow[];
}

export function useSeasonCoopSpotlight() {
  return useQuery({
    queryKey: ["season-coop-spotlight"],
    queryFn: async (): Promise<CoopSpotlightPayload> => {
      const { data, error } = await supabase.rpc("get_season_coop_spotlight");
      if (error) throw error;
      return (data as unknown as CoopSpotlightPayload) ?? { active: false };
    },
    refetchInterval: 120_000,
  });
}
