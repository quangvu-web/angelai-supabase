import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ShieldCheck, Coins, Award } from "lucide-react";
import { useDID } from "@/hooks/useDID";
import { useTrustProfile } from "@/hooks/useTrustProfile";
import { useCamlyCoin } from "@/hooks/useCamlyCoin";
import { useRegisterOrg, useStakeValidator, useMyOrgProfile } from "@/hooks/useOrgIdentity";
import { useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";

const TIER_ORDER = ["T0", "T1", "T2", "T3", "T4"];

export function BecomeValidatorPanel() {
  const navigate = useNavigate();
  const { data: did } = useDID();
  const { data: profile } = useTrustProfile();
  const camly = useCamlyCoin();
  const { data: myOrg } = useMyOrgProfile();
  const register = useRegisterOrg();
  const stake = useStakeValidator();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("community");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [stakeAmount, setStakeAmount] = useState("10000");

  const tier = profile?.trust_tier || "T0";
  const tierIdx = TIER_ORDER.indexOf(tier);
  const tierOk = tierIdx >= 2;
  const balanceNum = Number(camly.balance || 0);
  const stakeOk = balanceNum >= 10000;
  const didOk = !!did;
  const isAlreadyValidator = did?.entity_type === "validator";

  const allOk = didOk && tierOk && stakeOk;

  const handleRegister = () => {
    if (!name.trim()) return toast.error("Nhập tên validator");
    register.mutate(
      { entity_type: "validator", display_name: name.trim(), category, description: description.trim(), website: website.trim() || undefined },
      {
        onSuccess: (r: any) => {
          if (r?.success) {
            toast.success("Đã đăng ký validator. Tiến hành stake...");
            stake.mutate(Number(stakeAmount), {
              onSuccess: (rs: any) => {
                if (rs?.success) {
                  toast.success(`Stake ${Number(stakeAmount).toLocaleString()} CLY thành công`);
                  navigate("/validators");
                } else {
                  toast.error(rs?.error || "Stake lỗi");
                }
              },
            });
          } else toast.error(r?.error || "Đăng ký lỗi");
        },
      }
    );
  };

  if (isAlreadyValidator) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <ShieldCheck className="h-12 w-12 mx-auto text-emerald-500" />
          <div className="text-lg font-semibold">Bạn đã là Validator</div>
          {myOrg && (
            <Button onClick={() => navigate(`/org/${myOrg.slug || myOrg.did_id}`)}>
              Xem trang validator của bạn
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Điều kiện trở thành Validator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Check ok={didOk} label="Có DID (định danh phi tập trung)"
            cta={!didOk ? { text: "Tạo DID", to: "/identity/onboarding" } : undefined} />
          <Check ok={tierOk} label={`Trust Tier ≥ T2 (hiện tại: ${tier})`}
            cta={!tierOk ? { text: "Tăng tier", to: "/identity" } : undefined} />
          <Check ok={stakeOk} label={`Số dư ≥ 10,000 CLY (hiện tại: ${balanceNum.toLocaleString()})`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" /> Thông tin Validator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Tên hiển thị *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Pure Light Validator" disabled={!allOk} />
          </div>
          <div>
            <Label>Danh mục</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-md border bg-background text-sm"
              disabled={!allOk}
            >
              <option value="community">Community</option>
              <option value="dao">DAO</option>
              <option value="business">Business</option>
              <option value="edu">Education</option>
            </select>
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={!allOk} />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." disabled={!allOk} />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Coins className="h-3 w-3" /> Stake ban đầu (CLY) *</Label>
            <Input type="number" min={10000} value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} disabled={!allOk} />
            <p className="text-xs text-muted-foreground mt-1">Tối thiểu 10,000 CLY. Khoá 30 ngày. Slash nếu vi phạm.</p>
          </div>
          <Button
            className="w-full"
            disabled={!allOk || register.isPending || stake.isPending}
            onClick={handleRegister}
          >
            {register.isPending || stake.isPending ? "Đang đăng ký..." : "Đăng ký + Stake"}
          </Button>
          {!allOk && (
            <Badge variant="outline" className="w-full justify-center py-1.5">
              Hoàn thành các điều kiện ở trên trước
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Lợi ích</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1.5 text-muted-foreground">
          <p>• <b>×2 attestation weight</b> — chứng thực có sức nặng gấp đôi</p>
          <p>• <b>+5 CLY/attestation</b> — vào pending rewards, claim batch</p>
          <p>• Hồ sơ công khai tại <code>/org/your-slug</code></p>
          <p>• Có mặt trên Validator Marketplace</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Check({ ok, label, cta }: { ok: boolean; label: string; cta?: { text: string; to: string } }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
      {!ok && cta && (
        <Button size="sm" variant="link" className="h-auto p-0 ml-auto" onClick={() => navigate(cta.to)}>
          {cta.text} →
        </Button>
      )}
    </div>
  );
}
