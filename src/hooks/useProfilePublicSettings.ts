import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface ProfilePublicSettings {
  user_id: string;
  public_profile_enabled: boolean;
  allow_public_message: boolean;
  allow_public_transfer: boolean;
  allow_public_follow: boolean;
  show_friends_count: boolean;
  show_stats: boolean;
  show_modules: boolean;
  show_donation_button: boolean;
  enabled_modules: string[];
  featured_items: Record<string, unknown> | null;
  tagline: string | null;
  badge_type: string | null;
}

const DEFAULT_MODULES = [
  "fun_play",
  "fun_academy",
  "fun_market",
  "fun_charity",
  "fun_farm",
  "fun_life",
  "fun_invest",
];

const DEFAULT_SETTINGS: Omit<ProfilePublicSettings, "user_id"> = {
  public_profile_enabled: true,
  allow_public_message: true,
  allow_public_transfer: true,
  allow_public_follow: true,
  show_friends_count: true,
  show_stats: true,
  show_modules: true,
  show_donation_button: false,
  enabled_modules: DEFAULT_MODULES,
  featured_items: null,
  tagline: null,
  badge_type: null,
};

type ProfilePublicSettingsUpdate = Database["public"]["Tables"]["profile_public_settings"]["Update"];

export function useProfilePublicSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ProfilePublicSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profile_public_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          ...data,
          enabled_modules: Array.isArray(data.enabled_modules)
            ? (data.enabled_modules as string[])
            : DEFAULT_MODULES,
          featured_items: data.featured_items as Record<string, unknown> | null,
        });
      } else {
        // Create default settings
        const { data: newData, error: insertErr } = await supabase
          .from("profile_public_settings")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (insertErr) throw insertErr;
        setSettings({
          ...newData,
          enabled_modules: Array.isArray(newData.enabled_modules)
            ? (newData.enabled_modules as string[])
            : DEFAULT_MODULES,
          featured_items: newData.featured_items as Record<string, unknown> | null,
        });
      }
    } catch (err) {
      console.error("Error fetching public settings:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (updates: Partial<Omit<ProfilePublicSettings, "user_id">>) => {
      if (!user) return;
      setIsSaving(true);
      try {
        const payload: ProfilePublicSettingsUpdate = {
          updated_at: new Date().toISOString(),
        };

        if (updates.public_profile_enabled !== undefined) payload.public_profile_enabled = updates.public_profile_enabled;
        if (updates.allow_public_message !== undefined) payload.allow_public_message = updates.allow_public_message;
        if (updates.allow_public_transfer !== undefined) payload.allow_public_transfer = updates.allow_public_transfer;
        if (updates.allow_public_follow !== undefined) payload.allow_public_follow = updates.allow_public_follow;
        if (updates.show_friends_count !== undefined) payload.show_friends_count = updates.show_friends_count;
        if (updates.show_stats !== undefined) payload.show_stats = updates.show_stats;
        if (updates.show_modules !== undefined) payload.show_modules = updates.show_modules;
        if (updates.show_donation_button !== undefined) payload.show_donation_button = updates.show_donation_button;
        if (updates.enabled_modules !== undefined) payload.enabled_modules = updates.enabled_modules as Json;
        if (updates.featured_items !== undefined) payload.featured_items = updates.featured_items as Json | null;
        if (updates.tagline !== undefined) payload.tagline = updates.tagline;
        if (updates.badge_type !== undefined) payload.badge_type = updates.badge_type;

        const { error } = await supabase
          .from("profile_public_settings")
          .update(payload)
          .eq("user_id", user.id);

        if (error) throw error;

        setSettings((prev) =>
          prev ? { ...prev, ...updates } : null
        );

        toast({ title: "Đã lưu cài đặt ✨" });
      } catch (err) {
        console.error("Error saving public settings:", err);
        toast({
          title: "Lỗi",
          description: "Không thể lưu cài đặt.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [user]
  );

  return { settings, isLoading, isSaving, updateSettings, refetch: fetchSettings };
}
