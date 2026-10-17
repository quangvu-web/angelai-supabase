import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Check, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAddGuardian, useMyGuardians } from "@/hooks/useRecovery";

interface SearchResult {
  did_id: string;
  did_identifier: string;
  display_name: string;
  user_email: string;
  trust_tier: string;
}

/**
 * Inline guardian-add component for the onboarding wizard.
 * Reuses search_user_for_attestation RPC to find users by email/name/did.
 */
export function AddGuardianInline() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [note, setNote] = useState("");

  const { data: guardians = [] } = useMyGuardians();
  const addMut = useAddGuardian();

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2 || selected) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase.rpc("search_user_for_attestation", {
        _query: query.trim(),
      });
      setSearching(false);
      if (error) {
        toast.error("Lỗi tìm kiếm");
        return;
      }
      setResults((data ?? []) as SearchResult[]);
    }, 300);
    return () => clearTimeout(t);
  }, [query, selected]);

  const handleSubmit = async () => {
    if (!selected) return;
    // Need user_id, not did_id. Fetch user by did.
    const { data: didRow, error } = await supabase
      .from("user_dids")
      .select("user_id")
      .eq("id", selected.did_id)
      .maybeSingle();
    if (error || !didRow?.user_id) {
      toast.error("Không tìm thấy user");
      return;
    }
    await addMut.mutateAsync({ guardian_user_id: didRow.user_id, note: note.trim() || undefined });
    setSelected(null);
    setQuery("");
    setNote("");
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="text-sm font-medium flex items-center gap-2">
        <UserPlus className="h-4 w-4" /> Mời guardian mới
      </div>

      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium truncate">{selected.display_name}</span>
              <Badge variant="outline" className="text-[10px]">{selected.trust_tier}</Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate">{selected.user_email}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setSelected(null); setQuery(""); }}>
            Đổi
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Email, tên, hoặc DID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {searching && <p className="text-xs text-muted-foreground">Đang tìm...</p>}
          {results.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border">
              {results.map((r) => (
                <button
                  key={r.did_id}
                  onClick={() => { setSelected(r); setResults([]); }}
                  className="flex w-full items-center justify-between gap-2 p-2 hover:bg-muted/50 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{r.display_name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{r.trust_tier}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{r.user_email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground">Không tìm thấy.</p>
          )}
        </>
      )}

      <Textarea
        placeholder="Ghi chú gửi guardian (vd: Bạn của tôi, đã quen 5 năm)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        rows={2}
      />

      <Button
        onClick={handleSubmit}
        disabled={!selected || addMut.isPending || guardians.length >= 5}
        className="w-full"
        size="sm"
      >
        {addMut.isPending ? "Đang gửi..." : guardians.length >= 5 ? "Tối đa 5 guardian" : "Gửi lời mời"}
      </Button>
    </div>
  );
}
