import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { BookText, Plus, History, Pencil, RotateCcw } from "lucide-react";

type Template = {
  id: string;
  name: string;
  scope: string;
  body: string;
  version: number;
  active: boolean;
  updated_at: string;
};

type Version = {
  id: string;
  template_id: string;
  version: number;
  body: string;
  created_at: string;
};

export default function PromptGovernance() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [historyOf, setHistoryOf] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-prompt-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_prompt_templates" as any)
        .select("*")
        .order("scope").order("name");
      if (error) throw error;
      return (data || []) as unknown as Template[];
    },
  });

  const { data: versions } = useQuery({
    queryKey: ["ai-prompt-versions", historyOf?.id],
    enabled: !!historyOf,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_prompt_versions" as any)
        .select("*")
        .eq("template_id", historyOf!.id)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Version[];
    },
  });

  async function save(t: Partial<Template>) {
    if (t.id) {
      const { error } = await supabase
        .from("ai_prompt_templates" as any)
        .update({ name: t.name, scope: t.scope, body: t.body, active: t.active })
        .eq("id", t.id);
      if (error) return toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase
        .from("ai_prompt_templates" as any)
        .insert({ name: t.name, scope: t.scope, body: t.body });
      if (error) return toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    }
    toast({ title: "Đã lưu" });
    setEditing(null);
    setCreating(false);
    qc.invalidateQueries({ queryKey: ["ai-prompt-templates"] });
  }

  async function revertTo(v: Version) {
    const { error } = await supabase
      .from("ai_prompt_templates" as any)
      .update({ body: v.body })
      .eq("id", v.template_id);
    if (error) return toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    toast({ title: `Đã revert về v${v.version}` });
    setHistoryOf(null);
    qc.invalidateQueries({ queryKey: ["ai-prompt-templates"] });
  }

  return (
    <CorePageShell title="Prompt Governance" subtitle="System prompts · CRUD · version history" showPhase2={false}>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookText className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">System Prompts {data ? `(${data.length})` : ""}</h2>
          </div>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1">
            <Plus className="h-3 w-3" /> Tạo mới
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <div className="space-y-2">
            {data?.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">{t.scope}</Badge>
                    <Badge variant="outline" className="font-mono text-primary border-primary/40 text-[10px]">
                      v{t.version}
                    </Badge>
                    {!t.active && <Badge variant="destructive" className="text-[10px]">disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.body}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setHistoryOf(t)} title="History">
                    <History className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(t)} title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit / Create dialog */}
      <Dialog open={!!editing || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{creating ? "Tạo prompt" : `Sửa: ${editing?.name}`}</DialogTitle></DialogHeader>
          <PromptForm
            initial={editing ?? { name: "", scope: "chat", body: "", active: true } as any}
            onSave={save}
          />
        </DialogContent>
      </Dialog>

      {/* Version history dialog */}
      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Version history: {historyOf?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {versions?.map((v) => (
              <div key={v.id} className="p-2 border rounded">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono">v{v.version}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                  </div>
                  {historyOf && v.version !== historyOf.version && (
                    <Button size="sm" variant="outline" onClick={() => revertTo(v)} className="gap-1">
                      <RotateCcw className="h-3 w-3" /> Revert
                    </Button>
                  )}
                </div>
                <pre className="text-[11px] whitespace-pre-wrap bg-muted/40 p-2 rounded">{v.body}</pre>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </CorePageShell>
  );
}

function PromptForm({ initial, onSave }: { initial: Partial<Template>; onSave: (t: Partial<Template>) => void }) {
  const [f, setF] = useState({
    id: initial.id,
    name: initial.name ?? "",
    scope: initial.scope ?? "chat",
    body: initial.body ?? "",
    active: initial.active ?? true,
  });
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold">Tên</label>
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div>
        <label className="text-xs font-semibold">Scope</label>
        <Input value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}
          placeholder="persona | chat | safety | scoring | output | governance" />
      </div>
      <div>
        <label className="text-xs font-semibold">Body</label>
        <Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={8}
          className="font-mono text-xs" />
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f)} disabled={!f.name || !f.body}>Lưu</Button>
      </DialogFooter>
    </div>
  );
}
