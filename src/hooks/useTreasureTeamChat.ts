// @ts-nocheck
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TeamChatMessage {
  id: string;
  team_id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
}

export function useTreasureTeamChat(teamId: string | undefined) {
  const qc = useQueryClient();

  const messages = useQuery({
    queryKey: ["treasure-team-chat", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasure_team_chat_messages")
        .select("id, team_id, user_id, content, created_at")
        .eq("team_id", teamId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []).reverse();
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) return rows as TeamChatMessage[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, handle, avatar_url")
        .in("user_id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return rows.map((r) => ({ ...r, ...(map.get(r.user_id) ?? {}) })) as TeamChatMessage[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!teamId) return;
    const channel = supabase
      .channel(`tt-chat:${teamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "treasure_team_chat_messages", filter: `team_id=eq.${teamId}` },
        () => qc.invalidateQueries({ queryKey: ["treasure-team-chat", teamId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, qc]);

  const send = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.rpc("send_treasure_team_message", {
        p_team_id: teamId!, p_content: content,
      });
      if (error) throw error;
    },
    onError: (e: Error) => {
      const m = e.message;
      if (m.includes("rate_limited")) toast.error("Gửi chậm thôi (2 giây/tin)");
      else if (m.includes("too_long")) toast.error("Tin quá 500 ký tự");
      else if (m.includes("empty")) toast.error("Tin trống");
      else toast.error(m);
    },
  });

  return {
    messages: messages.data ?? [],
    isLoading: messages.isLoading,
    send: send.mutate,
    isSending: send.isPending,
  };
}
