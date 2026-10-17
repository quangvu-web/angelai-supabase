import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ATTESTATION_LABELS, useCreateAttestation, type AttestationType,
} from "@/hooks/useAttestations";

interface SearchResult {
  did_id: string;
  did_identifier: string;
  display_name: string;
  user_email: string;
  trust_tier: string;
}

interface Props { trigger?: React.ReactNode; }

export function AttestationDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [type, setType] = useState<AttestationType>("vouch_trust");
  const [note, setNote] = useState("");
  const createMut = useCreateAttestation();

  // Debounced search
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
      if (error) { toast.error("Lỗi tìm kiếm"); return; }
      setResults((data ?? []) as SearchResult[]);
    }, 300);
    return () => clearTimeout(t);
  }, [query, selected]);

  function reset() {
    setQuery(""); setResults([]); setSelected(null);
    setNote(""); setType("vouch_trust");
  }

  async function handleSubmit() {
    if (!selected) { toast.error("Vui lòng chọn người nhận"); return; }
    await createMut.mutateAsync({
      to_did_id: selected.did_id,
      attestation_type: type,
      note: note.trim() || undefined,
    });
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="bg-gradient-to-r from-amber-500 to-yellow-500 !text-black font-semibold">
            <UserPlus className="h-4 w-4 mr-1" /> Gửi Attestation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gửi Attestation P2P</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search user */}
          <div className="space-y-2">
            <Label>Tìm người nhận</Label>
            {selected ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium truncate">{selected.display_name}</span>
                    <Badge variant="outline" className="text-[10px]">{selected.trust_tier}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate font-mono">{selected.user_email}</div>
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
                  <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border">
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
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Loại attestation</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as AttestationType)}>
              {(Object.keys(ATTESTATION_LABELS) as AttestationType[]).map((k) => {
                const meta = ATTESTATION_LABELS[k];
                return (
                  <label key={k} htmlFor={k}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value={k} id={k} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{meta.label}</div>
                      <div className="text-xs text-muted-foreground">{meta.desc}</div>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Ghi chú (tuỳ chọn)</Label>
            <Textarea
              placeholder="Lý do bạn vouch cho người này..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{note.length}/300</p>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs space-y-1">
            <p className="font-semibold text-amber-700 dark:text-amber-400">⚠️ Quy tắc</p>
            <p>• Chỉ Trust Tier T1+ mới gửi được</p>
            <p>• Tối đa 5 attestation/ngày</p>
            <p>• Cooldown 30 ngày cho cùng cặp + loại</p>
            <p>• Có thể rút lại bất cứ lúc nào</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Huỷ</Button>
          <Button
            onClick={handleSubmit}
            disabled={!selected || createMut.isPending}
            className="bg-gradient-to-r from-amber-500 to-yellow-500 !text-black font-semibold"
          >
            {createMut.isPending ? "Đang gửi..." : "Gửi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
