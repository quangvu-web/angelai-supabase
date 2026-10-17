import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { smartBack } from "@/lib/smartBack";

export default function DailyCamlyCap() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
          <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>

        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Trần Camly 300.000/ngày</h1>
          <p className="text-sm text-muted-foreground">
            Chính sách bảo vệ kinh tế ánh sáng FUN.rich · áp dụng toàn hệ thống
          </p>
        </header>

        <Card className="p-5 space-y-3">
          <h2 className="text-xl font-semibold">Trần là gì?</h2>
          <p className="text-sm text-muted-foreground">
            Mỗi user nhận tối đa <strong className="text-foreground">300.000 Camly</strong> mỗi ngày
            (theo giờ Việt Nam, reset 00:00). Trần áp lên <em>mọi nguồn thưởng</em>: Daily Quest, PLP
            actions (đăng bài, comment, gratitude, learn, project, plant tree…), Mystery Box, Treasure
            Hunt, Referral, Lì xì, Validator reward, Early Adopter, Pet bonus.
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-xl font-semibold">Cơ chế "clip mềm"</h2>
          <p className="text-sm text-muted-foreground">
            Khi action thưởng vượt trần, hệ thống <strong>vẫn cấp phần còn lại</strong> rồi dừng — action
            không bị fail. Ví dụ: bạn còn 500 Camly trong trần, claim quest 2.000 Camly → nhận đủ 500,
            phần 1.500 còn lại được ghi nhận đã cắt (không chuyển sang ngày kế).
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-xl font-semibold">Tại sao cần trần?</h2>
          <p className="text-sm text-muted-foreground">
            <strong>Camly Coin</strong> là đơn vị thưởng nội bộ (off-chain) của hệ FUN.rich, hoàn toàn
            tách biệt với <strong>FUN Money</strong> (token on-chain BSC, mint theo cơ chế Adaptive Mint).
            Trần 300K áp lên Camly để bảo vệ kinh tế nội bộ (nâng từ 250K ngày 2026-05-19 để mở rộng dư địa cho 3 mini game mới: Lantern Path, Cosmic Riddles, Light Forge):
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
            <li>Chống farm cực đoan: cluster Sybil mất động lực vì trần cứng theo từng user.</li>
            <li>Giữ Camly không bị lạm phát mất giá khi quy đổi sang quyền lợi nội bộ (mua box, lì xì, gift…).</li>
            <li>Khuyến khích sống chậm — chất lượng hơn số lượng. 300K/ngày đủ cho user "perfect day" + chơi mini game mới.</li>
            <li>Phân phối công bằng giữa user mới và user lâu năm.</li>
            <li>Không liên quan và không ảnh hưởng tới pool FUN Money on-chain hay tỉ lệ mint FUN.</li>
          </ul>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-xl font-semibold">Công thức tính dư địa</h2>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`Multiplier max = streak (×2) × pet (×1.25) × Mastery (~×1.10) × Q×I×K (~×2)
              ≈ ×5.5 (cap mềm ×2.5 vẫn áp)

User "perfect day":  ~55K base × 5.5 ≈ 300K (chạm trần)
User trung bình:     ~55K base × 1.6 ≈ 88K
User casual:         ~20K base × 1.2 ≈ 24K`}
          </pre>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-xl font-semibold">Ngoại lệ</h2>
          <p className="text-sm text-muted-foreground">
            <strong>Quà tặng nhận từ user khác (gift_received)</strong> KHÔNG tính vào trần — để bạn vẫn
            có thể nhận tip/lì xì từ cộng đồng kể cả khi đã đạt trần earn cá nhân. Người gửi vẫn bị trừ
            balance bình thường và phần earn của họ vẫn nằm trong trần riêng.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Spending, gift_sent, project_donation, admin_adjustment</strong> không tính vào trần
            (di chuyển nội bộ, không phải mint mới).
          </p>
        </Card>

        <p className="text-center text-xs text-muted-foreground pt-4">
          Trần này có thể điều chỉnh theo chính sách kinh tế · cập nhật mới nhất 2026-05-19 (nâng 250K → 300K)
        </p>
      </div>
    </div>
  );
}
