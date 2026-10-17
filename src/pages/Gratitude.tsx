import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/router-compat";
import DailyGratitude from "@/components/DailyGratitude";
import GratitudeJournal from "@/components/GratitudeJournal";
import { smartBack } from "@/lib/smartBack";

export default function Gratitude() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background-pure">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-amber-200/30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => smartBack(navigate)}
            className="min-h-[44px] gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </Button>
          <h1 className="text-base sm:text-lg font-bold text-brand-golden">
            Nhật ký Biết ơn
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <p className="text-sm text-muted-foreground">
          Mỗi đêm hãy dành ít phút ghi lại 3 điều biết ơn và những lời tự thú thành thật.
          Bài viết được Angel A.I. chấm độ thuần khiết và cộng Camly Coin.
        </p>
        <DailyGratitude />
        <GratitudeJournal />
      </main>
    </div>
  );
}
