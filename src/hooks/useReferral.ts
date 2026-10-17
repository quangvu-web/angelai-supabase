import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const REF_KEY = "fun:ref";
const TRIED_KEY = "fun:ref-registered";

/**
 * Captures ?ref=<userid> from URL on mount and stores it in localStorage.
 * After login, calls register_referral once per user.
 * Exports tryCompleteReferral() for downstream callers (e.g. quest claim success).
 */
export function useReferralCapture() {
  const { user } = useAuth();
  const triedRef = useRef(false);

  // Capture ?ref= from URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && !localStorage.getItem(REF_KEY)) {
        localStorage.setItem(REF_KEY, ref);
      }
    } catch {
      // ignore
    }
  }, []);

  // Register referral after login
  useEffect(() => {
    if (!user || triedRef.current) return;
    const ref = localStorage.getItem(REF_KEY);
    if (!ref) return;
    if (localStorage.getItem(`${TRIED_KEY}:${user.id}`)) return;
    triedRef.current = true;
    supabase.rpc("register_referral", { p_referrer: ref }).then(() => {
      localStorage.setItem(`${TRIED_KEY}:${user.id}`, "1");
    });
  }, [user]);
}

export async function tryCompleteReferral() {
  try {
    await supabase.rpc("try_complete_referral");
  } catch {
    // silent
  }
}

export function buildReferralUrl(userId: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?ref=${userId}`;
}
