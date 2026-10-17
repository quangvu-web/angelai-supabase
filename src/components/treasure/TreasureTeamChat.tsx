import { useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageCircle, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTreasureTeamChat } from "@/hooks/useTreasureTeamChat";

interface Props {
  teamId: string;
  leaderUserId?: string;
}

export function TreasureTeamChat({ teamId, leaderUserId }: Props) {
  const { user } = useAuth();
  const chat = useTreasureTeamChat(teamId);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || chat.isSending) return;
    chat.send(v, { onSuccess: () => setText("") });
  };

  return (
    <Card className="p-3 space-y-2 border-emerald-400/30">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> Team Chat
        <span className="ml-auto text-[10px] text-muted-foreground">{chat.messages.length} tin · realtime</span>
      </div>

      <div ref={scrollRef} className="h-56 overflow-y-auto space-y-2 pr-1 bg-muted/20 rounded p-2">
        {chat.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : chat.messages.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6">Chưa có tin nhắn. Mở lời chào team nhé ✨</p>
        ) : (
          chat.messages.map((m) => {
            const mine = m.user_id === user?.id;
            const name = m.display_name || m.handle || "Ẩn danh";
            const initial = name.charAt(0).toUpperCase();
            const isLeader = leaderUserId && m.user_id === leaderUserId;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-6 w-6 shrink-0">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} alt={name} />}
                  <AvatarFallback className="text-[9px]">{initial}</AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {isLeader && <Crown className="h-2.5 w-2.5 text-amber-400" />}
                    <span className="truncate max-w-24">{name}</span>
                    <span>· {new Date(m.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className={`text-xs px-2.5 py-1.5 rounded-lg break-words whitespace-pre-wrap ${
                    mine ? "bg-emerald-500/20 text-foreground" : "bg-card border border-border/50"
                  }`}>
                    {m.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(e as any); } }}
          placeholder="Nhắn cho team… (Shift+Enter để xuống dòng)"
          maxLength={500}
          disabled={chat.isSending}
          rows={1}
          className="min-h-[36px] max-h-28 text-xs resize-none py-2"
        />
        <Button type="submit" size="sm" className="h-9 px-3 shrink-0" disabled={chat.isSending || !text.trim()}>
          {chat.isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </form>
      <p className="text-[10px] text-muted-foreground text-right">{text.length}/500</p>
    </Card>
  );
}
