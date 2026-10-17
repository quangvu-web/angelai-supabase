import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type PetElement = "fire" | "water" | "earth" | "air" | "light";
export type PetPersonality = "joyful" | "wise" | "bold" | "gentle";
export type PetEvolution = "spark" | "glow" | "flame" | "star" | "sun" | "cosmos";

export interface Pet {
  id: string;
  user_id: string;
  name: string;
  element: PetElement;
  personality: PetPersonality;
  level: number;
  xp: number;
  energy: number;
  mood: number;
  aura: number;
  evolution: PetEvolution;
  total_xp: number;
  last_fed_at: string | null;
  last_chat_at: string | null;
  created_at: string;
}

export interface PetChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export function xpForLevel(lvl: number) {
  return lvl * 100;
}

export function usePet() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const petQuery = useQuery({
    queryKey: ["pet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data ?? null) as Pet | null;
    },
  });

  const adopt = useMutation({
    mutationFn: async (vars: { name: string; element: PetElement; personality: PetPersonality }) => {
      const { data, error } = await supabase.rpc("adopt_pet", {
        p_name: vars.name,
        p_element: vars.element,
        p_personality: vars.personality,
      });
      if (error) throw error;
      return data as unknown as Pet;
    },
    onSuccess: () => {
      toast.success("Thú cưng ánh sáng đã đến với bạn ✨");
      qc.invalidateQueries({ queryKey: ["pet", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: async (newName: string) => {
      const name = newName.trim();
      if (name.length < 1 || name.length > 24) {
        throw new Error("Tên dài 1–24 ký tự");
      }
      if (!petQuery.data?.id) throw new Error("Chưa có thú cưng");
      const { error } = await supabase
        .from("pets")
        .update({ name })
        .eq("id", petQuery.data.id);
      if (error) throw error;
      return name;
    },
    onSuccess: (name) => {
      toast.success(`Đã đổi tên thành "${name}" ✨`);
      qc.invalidateQueries({ queryKey: ["pet", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chatHistory = useQuery({
    queryKey: ["pet-chat", petQuery.data?.id],
    enabled: !!petQuery.data?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_chat_messages")
        .select("id, role, content, created_at")
        .eq("pet_id", petQuery.data!.id)
        .order("created_at", { ascending: true })
        .limit(50);
      return (data ?? []) as PetChatMsg[];
    },
  });

  const care = useMutation({
    mutationFn: async (action: "feed" | "play" | "meditate") => {
      const { data, error } = await supabase.functions.invoke("pet-care", { body: { action } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        ok: true; action: string; label: string; emoji: string;
        xp_gained: number; stat: string; stat_new: number;
        xp: { level: number; leveled_up: boolean; evolution: string } | null;
      };
    },
    onSuccess: (data) => {
      toast.success(`${data.emoji} ${data.label} +${data.xp_gained} XP`, {
        description: `${data.stat.toUpperCase()} → ${data.stat_new}/100`,
      });
      qc.invalidateQueries({ queryKey: ["pet", user?.id] });
      qc.invalidateQueries({ queryKey: ["pet-care-today", user?.id] });
      if (data.xp?.leveled_up) {
        toast.success(`🎉 Thú cưng lên Level ${data.xp.level}!`, { description: `Evolution: ${data.xp.evolution}` });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const careToday = useQuery({
    queryKey: ["pet-care-today", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("pet_xp_ledger")
        .select("source_ref")
        .eq("user_id", user!.id)
        .eq("source", "care")
        .like("source_ref", `care:%:${today}`);
      const done = new Set<string>();
      (data ?? []).forEach((r) => {
        const m = r.source_ref?.match(/^care:([^:]+):/);
        if (m) done.add(m[1]);
      });
      return done;
    },
  });

  const chat = useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase.functions.invoke("pet-chat", { body: { message } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { reply: string; xp: { level: number; leveled_up: boolean; evolution: string } | null };
    },
    onMutate: async (message: string) => {
      const petId = petQuery.data?.id;
      if (!petId) return;
      const key = ["pet-chat", petId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PetChatMsg[]>(key) ?? [];
      const optimistic: PetChatMsg = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<PetChatMsg[]>(key, [...prev, optimistic]);
      return { prev, key };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.key && ctx.prev) qc.setQueryData(ctx.key, ctx.prev);
      toast.error(e.message || "Pet đang bận, thử lại sau nhé");
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["pet-chat", petQuery.data?.id] });
      qc.invalidateQueries({ queryKey: ["pet", user?.id] });
      if (data.xp?.leveled_up) {
        toast.success(`🎉 Thú cưng lên Level ${data.xp.level}!`, {
          description: `Evolution: ${data.xp.evolution}`,
        });
      }
    },
  });

  return {
    pet: petQuery.data,
    isLoading: petQuery.isLoading,
    adopt: adopt.mutate,
    adoptAsync: adopt.mutateAsync,
    isAdopting: adopt.isPending,
    chatHistory: chatHistory.data ?? [],
    chat: chat.mutate,
    isChatting: chat.isPending,
    care: care.mutate,
    isCaring: care.isPending,
    careTodayDone: careToday.data ?? new Set<string>(),
    rename: rename.mutateAsync,
    isRenaming: rename.isPending,
  };
}
