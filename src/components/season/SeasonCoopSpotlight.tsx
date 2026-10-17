import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeartHandshake, Loader2, Network, Users2, Compass, ArrowRight } from "lucide-react";
import { useSeasonCoopSpotlight } from "@/hooks/useSeasonCoopSpotlight";
import { Link, useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function initials(name?: string | null, fallback = "?") {
  const t = (name || fallback).trim();
  return t.slice(0, 2).toUpperCase();
}

export function SeasonCoopSpotlight() {
  const { data, isLoading } = useSeasonCoopSpotlight();
  const { user } = useAuth();
  const navigate = useNavigate();

  const goCreateTeam = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Hãy đăng nhập để lập đội săn kho báu nhé!");
      navigate("/auth");
      return;
    }
    navigate("/treasure/team/new");
  };

  const onCreateTeamKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goCreateTeam(e);
    }
  };

  // Generic Enter/Space handler for <a>/Link elements (a handles Enter natively but not Space).
  const linkKeyActivate = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      (e.currentTarget as HTMLAnchorElement).click();
    }
  };

  const myTeam = useQuery({
    queryKey: ["my-any-treasure-team", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasure_team_members")
        .select("team_id, treasure_teams!inner(id, name)")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as { team_id: string; treasure_teams: { id: string; name: string } } | null;
    },
  });
  const teamId = myTeam.data?.team_id ?? null;
  const hasTeamRow = !!myTeam.data;
  const inTeam = !!teamId;

  if (isLoading) {
    return (
      <Card className="p-4 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Card>
    );
  }
  if (!data?.active) return null;

  const teams = data.top_teams ?? [];
  const contributors = data.top_contributors ?? [];
  const connected = data.most_connected ?? [];

  const EmptyHint = ({ msg }: { msg: string }) => (
    <div className="rounded-md border border-dashed border-amber-400/30 bg-amber-50/30 dark:bg-amber-950/10 px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
      <span className="text-[11px] text-muted-foreground italic flex-1">
        {msg}
        {inTeam && myTeam.data?.treasure_teams?.name && (
          <> · Đội của bạn: <span className="font-semibold text-foreground not-italic">{myTeam.data.treasure_teams.name}</span></>
        )}
      </span>
      {inTeam ? (
        <Button asChild size="sm" variant="outline" className="h-8 text-xs border-amber-400/50">
          <Link to={`/treasure#team-${teamId}`} onKeyDown={linkKeyActivate} aria-label="Vào trang đội của bạn">
            Vào trang đội của bạn <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      ) : hasTeamRow ? (
        <Button size="sm" variant="outline" className="h-8 text-xs border-amber-400/50" onClick={goCreateTeam} onKeyDown={onCreateTeamKeyDown} aria-label="Tạo đội săn kho báu mới">
          <Compass className="h-3.5 w-3.5 mr-1" /> Tạo đội mới
        </Button>
      ) : (
        <Button
          asChild
          size="sm"
          className="h-8 text-xs bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold hover:opacity-90"
        >
          <Link to="/treasure" onKeyDown={linkKeyActivate} aria-label="Lập đội săn kho báu">
            <Compass className="h-3.5 w-3.5 mr-1" /> Lập đội săn kho báu
          </Link>
        </Button>
      )}
    </div>
  );

  return (
    <Card className="p-4 space-y-4 border-amber-400/30">
      <div className="flex items-center gap-2">
        <HeartHandshake className="h-4 w-4 text-rose-500" />
        <h2 className="font-extrabold text-sm">Co-op Spotlight</h2>
        <Badge variant="outline" className="text-[10px]">cùng tiến · không cạnh tranh</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Vinh danh tinh thần đồng hành mùa này — không có thưởng riêng, chỉ ghi nhận đóng góp.
      </p>

      {/* Top Teams */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Users2 className="h-3.5 w-3.5 text-amber-500" /> Top đội cùng săn
        </div>
        {teams.length === 0 ? (
          <EmptyHint msg="Chưa có đội nào giải clue mùa này" />
        ) : (
        <div className="grid gap-1.5">
            {teams.slice(0, 5).map((t, i) => (
              <div key={t.team_id} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-center font-mono text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate font-medium">{t.team_name}</span>
                <span className="text-[10px] text-muted-foreground">{t.member_count} thành viên</span>
                <span className="font-bold text-amber-600 tabular-nums w-10 text-right">{t.solved_total}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Contributors */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <HeartHandshake className="h-3.5 w-3.5 text-rose-500" /> Đóng góp cho team
        </div>
        {contributors.length === 0 ? (
          <EmptyHint msg="Chưa ai đóng góp giải clue cho team mùa này" />
        ) : (
          <div className="grid gap-1.5">
            {contributors.slice(0, 8).map((c, i) => {
              const name = c.display_name || c.handle || "Ẩn danh";
              return (
                <Link
                  key={c.user_id}
                  to={c.handle ? `/u/${c.handle}` : "#"}
                  onKeyDown={linkKeyActivate}
                  aria-label={`Xem hồ sơ ${name}`}
                  className="flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-1 py-1"
                >
                  <span className="w-5 text-center font-mono text-muted-foreground">{i + 1}</span>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={c.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate font-medium">{name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.teams_helped} team</span>
                  <span className="font-bold text-rose-600 tabular-nums w-10 text-right">{c.contributions}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Most Connected */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Network className="h-3.5 w-3.5 text-indigo-500" /> Người kết nối nhiều team
        </div>
        {connected.length === 0 ? (
          <EmptyHint msg="Chưa có ai tham gia nhiều team" />
        ) : (
          <div className="grid gap-1.5">
            {connected.slice(0, 5).map((c, i) => {
              const name = c.display_name || c.handle || "Ẩn danh";
              return (
                <Link
                  key={c.user_id}
                  to={c.handle ? `/u/${c.handle}` : "#"}
                  onKeyDown={linkKeyActivate}
                  aria-label={`Xem hồ sơ ${name}`}
                  className="flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-1 py-1"
                >
                  <span className="w-5 text-center font-mono text-muted-foreground">{i + 1}</span>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={c.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate font-medium">{name}</span>
                  <span className="font-bold text-indigo-600 tabular-nums w-10 text-right">{c.teams_joined}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
