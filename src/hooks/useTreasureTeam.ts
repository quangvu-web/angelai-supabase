import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface OpenTeam {
  team_id: string;
  name: string;
  member_count: number;
  max_size: number;
  leader_user_id: string;
}

export interface TeamProgressRow {
  user_id: string;
  joined_at: string;
  solved_count: number;
  is_leader: boolean;
}

export function useTreasureTeam(eventId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const myTeam = useQuery({
    queryKey: ["my-treasure-team", eventId, user?.id],
    enabled: !!eventId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("treasure_team_members")
        .select("team_id, treasure_teams!inner(id, name, leader_user_id, event_id)")
        .eq("user_id", user!.id)
        .eq("treasure_teams.event_id", eventId!)
        .maybeSingle();
      return data as { team_id: string; treasure_teams: { id: string; name: string; leader_user_id: string } } | null;
    },
  });

  const openTeams = useQuery({
    queryKey: ["open-treasure-teams", eventId],
    enabled: !!eventId && !myTeam.data,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_open_treasure_teams", { p_event_id: eventId! });
      if (error) throw error;
      return (data ?? []) as OpenTeam[];
    },
  });

  const teamProgress = useQuery({
    queryKey: ["treasure-team-progress", myTeam.data?.team_id],
    enabled: !!myTeam.data?.team_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_treasure_team_progress", { p_team_id: myTeam.data!.team_id });
      if (error) throw error;
      return (data ?? []) as TeamProgressRow[];
    },
    refetchInterval: 30000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-treasure-team"] });
    qc.invalidateQueries({ queryKey: ["open-treasure-teams"] });
    qc.invalidateQueries({ queryKey: ["treasure-team-progress"] });
  };

  const create = useMutation({
    mutationFn: async (vars: { name: string; maxSize: number }) => {
      const { data, error } = await supabase.rpc("create_treasure_team", {
        p_event_id: eventId!, p_name: vars.name, p_max_size: vars.maxSize,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { toast.success("Đã tạo team ✨"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const join = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.rpc("join_treasure_team", { p_team_id: teamId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Đã tham gia team"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_treasure_team", { p_team_id: myTeam.data!.team_id });
      if (error) throw error;
    },
    onSuccess: () => { toast("Đã rời team"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    myTeam: myTeam.data,
    openTeams: openTeams.data ?? [],
    teamProgress: teamProgress.data ?? [],
    isLoading: myTeam.isLoading,
    create: create.mutate, isCreating: create.isPending,
    join: join.mutate, isJoining: join.isPending,
    leave: leave.mutate, isLeaving: leave.isPending,
  };
}
