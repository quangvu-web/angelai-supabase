import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, LogOut, Plus, Loader2, Eye, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useTreasureTeam, type OpenTeam } from "@/hooks/useTreasureTeam";
import { TeamPeekDialog } from "@/components/treasure/TeamPeekDialog";
import { TreasureTeamChat } from "@/components/treasure/TreasureTeamChat";
import { JackpotSplitPanel } from "@/components/treasure/JackpotSplitPanel";

export function TreasureTeamPanel({ eventId, totalClues }: { eventId: string; totalClues: number }) {
  const t = useTreasureTeam(eventId);
  const navigate = useNavigate();
  const location = useLocation();
  const [peek, setPeek] = useState<OpenTeam | null>(null);

  // Auto-scroll + highlight when arriving via hash like #team-<id>
  useEffect(() => {
    if (!t.myTeam?.team_id) return;
    const target = `team-${t.myTeam.team_id}`;
    if (location.hash === `#${target}`) {
      const el = document.getElementById(target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-amber-400/60");
        setTimeout(() => el.classList.remove("ring-2", "ring-amber-400/60"), 2400);
      }
    }
  }, [location.hash, t.myTeam?.team_id]);

  if (t.isLoading) {
    return <Card className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></Card>;
  }

  if (t.myTeam) {
    const inviteUrl = `${window.location.origin}/treasure#team-${t.myTeam.team_id}`;
    const inviteText = `Tham gia team "${t.myTeam.treasure_teams.name}" cùng mình săn kho báu ánh sáng ✨\n${inviteUrl}`;

    const handleShare = async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: "Co-op Team", text: inviteText, url: inviteUrl });
        } else {
          await navigator.clipboard.writeText(inviteText);
          toast.success("Đã copy lời mời — gửi cho bạn bè nhé!");
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") toast.error("Không chia sẻ được");
      }
    };

    const handleCopy = async () => {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Đã copy link mời");
    };

    return (
      <div className="space-y-3" id={`team-${t.myTeam.team_id}`}>
        <Card className="p-4 space-y-3 border-emerald-400/40 bg-gradient-to-br from-emerald-500/10 to-teal-700/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-sm">Team: {t.myTeam.treasure_teams.name}</span>
              <Badge variant="outline" className="text-[10px]">{t.teamProgress.length} thành viên</Badge>
            </div>
            <Button size="sm" variant="ghost" disabled={t.isLeaving} onClick={() => t.leave()}>
              <LogOut className="h-3 w-3 mr-1" /> Rời
            </Button>
          </div>

          <div className="flex items-center gap-2 p-2 rounded bg-background/40 border border-emerald-400/20">
            <code className="flex-1 text-[10px] font-mono text-muted-foreground truncate">{inviteUrl}</code>
            <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" onClick={handleCopy} title="Copy link">
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="sm" className="h-7 px-2 shrink-0 bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold" onClick={handleShare}>
              <Share2 className="h-3 w-3 mr-1" /> Mời
            </Button>
          </div>

          <div className="space-y-1">
            {t.teamProgress.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-1.5">
                  {m.is_leader && <Crown className="h-3 w-3 text-amber-400" />}
                  <span className="font-mono text-muted-foreground">{m.user_id.slice(0, 8)}…</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">{m.solved_count}/{totalClues} clue</Badge>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Tiến độ chia sẻ trong team — cùng săn fragment để chia jackpot.</p>
        </Card>

        <JackpotSplitPanel teamId={t.myTeam.team_id} />
        <TreasureTeamChat teamId={t.myTeam.team_id} leaderUserId={t.myTeam.treasure_teams.leader_user_id} />
      </div>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" /> Co-op Team
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/treasure/team/new")}>
          <Plus className="h-3 w-3 mr-1" /> Tạo team
        </Button>
      </div>

      {t.openTeams.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Chưa có team mở nào — tạo team mới và mời bạn bè!</p>
      ) : (
        <div className="space-y-1.5">
          {t.openTeams.map((tm) => (
            <div key={tm.team_id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
              <div className="min-w-0">
                <div className="font-semibold truncate">{tm.name}</div>
                <div className="text-[10px] text-muted-foreground">{tm.member_count}/{tm.max_size} người</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setPeek(tm)} title="Xem thành viên">
                  <Eye className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" disabled={t.isJoining} onClick={() => t.join(tm.team_id)}>
                  Tham gia
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TeamPeekDialog
        open={!!peek}
        onOpenChange={(o) => !o && setPeek(null)}
        teamId={peek?.team_id ?? null}
        teamName={peek?.name ?? ""}
        memberCount={Number(peek?.member_count ?? 0)}
        maxSize={peek?.max_size ?? 0}
      />
    </Card>
  );
}
