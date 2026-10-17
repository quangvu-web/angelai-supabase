import { Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { buildReferralUrl } from "@/hooks/useReferral";
import { toast } from "sonner";

interface ShareCardProps {
  title: string;
  description?: string;
  emoji?: string;
}

export default function ShareCard({ title, description, emoji = "✨" }: ShareCardProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  if (!user) return null;
  const url = buildReferralUrl(user.id);
  const text = `${emoji} ${title}${description ? `\n${description}` : ""}\n\nTham gia FUN cùng mình — cả hai +20000 Camly khi bạn hoàn thành quest đầu tiên trong 24h:\n${url}`;

  const onShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // user canceled
      }
    } else {
      onCopy();
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Đã copy link mời bạn ✨");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không copy được");
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-[#b8860b]/10 via-[#daa520]/5 to-transparent border-[#daa520]/30">
      <div className="flex items-start gap-3">
        <div className="text-3xl">{emoji}</div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{title}</h4>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          <p className="text-xs text-muted-foreground mt-2">
            Mời bạn — cả hai nhận <span className="font-bold text-amber-500">+20000 Camly</span> khi họ hoàn thành quest đầu tiên trong 24h.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={onShare} className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold flex-1 min-h-11">
              <Share2 className="h-4 w-4 mr-1" /> Chia sẻ
            </Button>
            <Button size="sm" variant="outline" onClick={onCopy} className="min-h-11">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
