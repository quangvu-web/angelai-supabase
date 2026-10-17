import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Users, Sparkles, Loader2, Minus, Plus, Radio, Eye } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTreasure } from "@/hooks/useTreasure";
import { useTreasureTeam, type OpenTeam } from "@/hooks/useTreasureTeam";
import { TeamPeekDialog } from "@/components/treasure/TeamPeekDialog";
import { smartBack } from "@/lib/smartBack";

const teamSchema = z.object({
  name: z.string().trim().min(2, "Tên tối thiểu 2 ký tự").max(40, "Tối đa 40 ký tự"),
  maxSize: z.number().int().min(2).max(10),
});

export default function TreasureTeamCreate() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const t = useTreasure();
  const team = useTreasureTeam(t.event?.id);
  const eventCap = t.event?.max_team_size ?? 5;

  const [name, setName] = useState("");
  const [maxSize, setMaxSize] = useState(Math.min(5, eventCap));
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  const [peek, setPeek] = useState<OpenTeam | null>(null);

  useEffect(() => { setMaxSize((s) => Math.min(s, eventCap)); }, [eventCap]);

  useEffect(() => {
    if (team.myTeam) navigate("/treasure", { replace: true });
  }, [team.myTeam, navigate]);

  // Realtime subscription — refresh open teams when anyone joins/leaves
  useEffect(() => {
    if (!t.event?.id) return;
    const channel = supabase
      .channel(`treasure-team-members:${t.event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "treasure_team_members" },
        () => {
          qc.invalidateQueries({ queryKey: ["open-treasure-teams", t.event!.id] });
          setPulse(true);
          setTimeout(() => setPulse(false), 700);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "treasure_teams", filter: `event_id=eq.${t.event.id}` },
        () => qc.invalidateQueries({ queryKey: ["open-treasure-teams", t.event!.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [t.event?.id, qc]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = teamSchema.safeParse({ name, maxSize });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (!t.event?.id) { setError("Không có sự kiện đang diễn ra."); return; }
    team.create({ name: parsed.data.name, maxSize: parsed.data.maxSize }, {
      onSuccess: () => navigate("/treasure"),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
          <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Users className="h-6 w-6 text-emerald-400" /> Tạo Co-op Team
          </h1>
          <p className="text-xs text-muted-foreground">
            Cùng bạn bè săn fragment & chia jackpot trong sự kiện{" "}
            <span className="font-semibold text-foreground">{t.event?.name ?? "—"}</span>
          </p>
        </div>

        <Card className="p-5">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="team-name">Tên team</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ánh Sáng Của Cha"
                maxLength={40}
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">{name.length}/40 ký tự</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Giới hạn thành viên</Label>
                <span className="text-sm font-bold text-emerald-400">{maxSize} người</span>
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" size="icon" variant="outline" className="h-9 w-9"
                  disabled={maxSize <= 2} onClick={() => setMaxSize((s) => Math.max(2, s - 1))}>
                  <Minus className="h-3 w-3" />
                </Button>
                <Slider
                  value={[maxSize]}
                  onValueChange={(v) => setMaxSize(v[0])}
                  min={2}
                  max={Math.min(10, eventCap)}
                  step={1}
                  className="flex-1"
                />
                <Button type="button" size="icon" variant="outline" className="h-9 w-9"
                  disabled={maxSize >= Math.min(10, eventCap)} onClick={() => setMaxSize((s) => Math.min(eventCap, s + 1))}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Sự kiện cho phép tối đa <strong>{eventCap}</strong> người / team. Nhỏ thì thân, lớn thì nhanh.
              </p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="submit" className="w-full min-h-11" disabled={team.isCreating || !t.event}>
              {team.isCreating
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Sparkles className="h-4 w-4" /> Tạo team</>}
            </Button>
          </form>
        </Card>

        {/* Live open teams */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" /> Team đang mở
              <Badge variant="outline" className="text-[10px]">{team.openTeams.length}</Badge>
            </div>
            <span className={`flex items-center gap-1 text-[10px] text-muted-foreground transition-colors ${pulse ? "text-emerald-400" : ""}`}>
              <Radio className={`h-3 w-3 ${pulse ? "animate-ping" : ""}`} /> Realtime
            </span>
          </div>

          {team.openTeams.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">
              Chưa có team mở nào. Tạo team đầu tiên ✨
            </p>
          ) : (
            <div className="space-y-2">
              {team.openTeams.map((tm) => {
                const pct = (Number(tm.member_count) / tm.max_size) * 100;
                const full = Number(tm.member_count) >= tm.max_size;
                return (
                  <div key={tm.team_id} className="space-y-1.5 p-2 rounded bg-muted/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold truncate">{tm.name}</span>
                      <Badge variant={full ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                        {tm.member_count}/{tm.max_size}
                      </Badge>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {full ? "Đã đầy" : `Còn ${tm.max_size - Number(tm.member_count)} chỗ`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                          onClick={() => setPeek(tm)} title="Xem thành viên">
                          <Eye className="h-3 w-3 mr-1" /> Xem
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px]"
                          disabled={team.isJoining || full}
                          onClick={() => team.join(tm.team_id, { onSuccess: () => navigate("/treasure") })}>
                          Tham gia
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <TeamPeekDialog
          open={!!peek}
          onOpenChange={(o) => !o && setPeek(null)}
          teamId={peek?.team_id ?? null}
          teamName={peek?.name ?? ""}
          memberCount={Number(peek?.member_count ?? 0)}
          maxSize={peek?.max_size ?? 0}
        />
      </div>
    </div>
  );
}
