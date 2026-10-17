import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CircleMember {
  user_id: string;
  role: "founder" | "steward" | "member";
  joined_at: string;
  contributed_light: number;
  display_name: string;
  avatar_url: string | null;
  handle: string | null;
}
export interface CircleMessage {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  display_name: string;
  avatar_url: string | null;
}
export interface CircleInvite {
  code: string;
  expires_at: string;
  uses_left: number;
}
export interface CirclePayload {
  in_circle: boolean;
  circle?: {
    id: string;
    code: string;
    name: string;
    motto: string | null;
    avatar_emoji: string;
    member_count: number;
    max_members: number;
    light_pool: number;
    is_open: boolean;
    created_at: string;
  };
  my_role?: "founder" | "steward" | "member";
  members?: CircleMember[];
  messages?: CircleMessage[];
  invites?: CircleInvite[];
}

export interface OpenCircle {
  id: string;
  name: string;
  motto: string | null;
  emoji: string;
  member_count: number;
  max_members: number;
  created_at: string;
}

const errMap: Record<string, string> = {
  unauthorized: "Hãy đăng nhập trước nhé",
  already_in_circle: "Bạn đang ở một Vòng Sáng khác — hãy rời trước",
  not_in_circle: "Bạn chưa ở vòng nào",
  circle_full: "Vòng đã đủ thành viên",
  invalid_invite: "Mã mời không hợp lệ hoặc đã hết hạn",
  not_open: "Vòng này không mở để tham gia tự do",
  not_officer: "Chỉ founder/steward mới làm được",
  rate_limited: "Bạn nhắn nhanh quá — đợi vài giây nhé",
  invalid_length: "Tin nhắn phải từ 1–500 ký tự",
};
const xerr = (e: Error) => toast.error(errMap[e.message] ?? "Có lỗi, thử lại nhé");

export function useLightCircle() {
  const qc = useQueryClient();

  const my = useQuery({
    queryKey: ["my-light-circle"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_light_circle");
      if (error) throw error;
      return data as unknown as CirclePayload;
    },
  });

  const open = useQuery({
    queryKey: ["open-light-circles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_open_light_circles", { p_limit: 30 });
      if (error) throw error;
      return (data as unknown as OpenCircle[]) ?? [];
    },
    enabled: my.data?.in_circle === false,
  });

  const circleId = my.data?.circle?.id;

  // Realtime: chat messages + circle updates
  useEffect(() => {
    if (!circleId) return;
    const ch = supabase
      .channel(`light-circle:${circleId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "light_circle_chat_messages", filter: `circle_id=eq.${circleId}` },
        () => qc.invalidateQueries({ queryKey: ["my-light-circle"] })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "light_circles", filter: `id=eq.${circleId}` },
        () => qc.invalidateQueries({ queryKey: ["my-light-circle"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "light_circle_members", filter: `circle_id=eq.${circleId}` },
        () => qc.invalidateQueries({ queryKey: ["my-light-circle"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [circleId, qc]);

  const create = useMutation({
    mutationFn: async (v: { name: string; motto: string; emoji: string; is_open: boolean }) => {
      const { data, error } = await supabase.rpc("create_light_circle", {
        p_name: v.name, p_motto: v.motto, p_emoji: v.emoji, p_is_open: v.is_open,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Đã tạo Vòng Sáng ✨");
      qc.invalidateQueries({ queryKey: ["my-light-circle"] });
    },
    onError: xerr,
  });

  const joinByCode = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("join_light_circle_by_code", { p_code: code });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Đã vào Vòng Sáng");
      qc.invalidateQueries({ queryKey: ["my-light-circle"] });
    },
    onError: xerr,
  });

  const joinOpen = useMutation({
    mutationFn: async (circle_id: string) => {
      const { data, error } = await supabase.rpc("join_open_light_circle", { p_circle_id: circle_id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Đã vào Vòng Sáng");
      qc.invalidateQueries({ queryKey: ["my-light-circle"] });
    },
    onError: xerr,
  });

  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_light_circle");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bạn đã rời Vòng Sáng");
      qc.invalidateQueries({ queryKey: ["my-light-circle"] });
    },
    onError: xerr,
  });

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.rpc("send_light_circle_message", { p_body: body });
      if (error) throw error;
    },
    onError: xerr,
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!circleId) throw new Error("not_in_circle");
      const { data, error } = await supabase.rpc("create_light_circle_invite", { p_circle_id: circleId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Đã tạo mã mời mới");
      qc.invalidateQueries({ queryKey: ["my-light-circle"] });
    },
    onError: xerr,
  });

  return {
    my: my.data,
    isLoading: my.isLoading,
    openCircles: open.data ?? [],
    create, joinByCode, joinOpen, leave, sendMessage, createInvite,
  };
}
