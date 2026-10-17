import { useQuery } from "@tanstack/react-query";
import { Crown, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface PeekMember {
  user_id: string;
  joined_at: string;
  is_leader: boolean;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  teamName: string;
  memberCount: number;
  maxSize: number;
}

export function TeamPeekDialog({ open, onOpenChange, teamId, teamName, memberCount, maxSize }: Props) {
  const q = useQuery({
    queryKey: ["peek-treasure-team", teamId],
    enabled: open && !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("peek_treasure_team_members", { p_team_id: teamId! });
      if (error) throw error;
      return (data ?? []) as PeekMember[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" /> {teamName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="text-[10px]">{memberCount}/{maxSize} thành viên</Badge>
            <span className="text-muted-foreground">Sắp xếp theo thứ tự tham gia</span>
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : q.error ? (
          <p className="text-xs text-destructive py-3">Không tải được danh sách.</p>
        ) : (q.data?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">Chưa có thành viên.</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {q.data!.map((m) => {
              const name = m.display_name || m.handle || "Ẩn danh";
              const initial = name.charAt(0).toUpperCase();
              return (
                <li key={m.user_id} className="flex items-center gap-3 p-2 rounded bg-muted/30">
                  <Avatar className="h-8 w-8">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} alt={name} />}
                    <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">{name}</span>
                      {m.is_leader && <Crown className="h-3 w-3 text-amber-400 shrink-0" />}
                    </div>
                    {m.handle && <p className="text-[10px] text-muted-foreground truncate">@{m.handle}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(m.joined_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
