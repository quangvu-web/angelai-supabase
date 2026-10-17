import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import type { CircleMessage } from "@/hooks/useLightCircle";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  messages: CircleMessage[];
  onSend: (body: string) => void;
  isSending: boolean;
}

const initials = (n: string) => n.trim().slice(0, 2).toUpperCase();

export function LightCircleChat({ messages, onSend, isSending }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    const v = text.trim();
    if (!v || v.length > 500 || isSending) return;
    onSend(v);
    setText("");
  };

  return (
    <div className="flex flex-col h-[420px] border rounded-lg overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-6">
            Chưa có ai nhắn — hãy là người đầu tiên gửi lời chào ✨
          </p>
        )}
        {messages.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={m.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">{initials(m.display_name)}</AvatarFallback>
              </Avatar>
              <div className={`max-w-[78%] ${mine ? "text-right" : ""}`}>
                <p className="text-[10px] text-muted-foreground">{m.display_name}</p>
                <p className={`inline-block text-sm rounded-2xl px-3 py-1.5 break-words whitespace-pre-wrap text-left ${mine ? "bg-amber-500/15 border border-amber-400/30" : "bg-muted"}`}>
                  {m.body}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t p-2 flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Gửi lời thắp sáng… (Shift+Enter để xuống dòng)"
          maxLength={500}
          rows={1}
          className="flex-1 min-h-[40px] max-h-32 resize-none"
        />
        <Button size="icon" onClick={submit} disabled={isSending || !text.trim()} className="bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
