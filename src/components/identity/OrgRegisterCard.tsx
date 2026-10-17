import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRegisterOrg, useMyOrgProfile } from "@/hooks/useOrgIdentity";
import { Building2, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function OrgRegisterCard() {
  const { data: myOrg } = useMyOrgProfile();
  const [open, setOpen] = useState(false);
  const [entityType, setEntityType] = useState<"org" | "validator">("org");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("community");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const navigate = useNavigate();
  const register = useRegisterOrg();

  const handleSubmit = () => {
    if (!name.trim()) return toast.error("Cần tên hiển thị");
    register.mutate(
      { entity_type: entityType, display_name: name, category, description, website },
      {
        onSuccess: (res: any) => {
          if (res?.success) {
            toast.success(`Đã đăng ký ${entityType === "org" ? "Tổ chức" : "Validator"}`);
            setOpen(false);
            navigate(`/org/${res.slug}`);
          } else {
            const msg: Record<string, string> = {
              already_registered: "DID đã đăng ký rồi",
              validator_requires_tier_t2: "Validator yêu cầu Trust Tier ≥ T2",
              no_did_found: "Cần có DID trước",
            };
            toast.error(msg[res?.error] || res?.error);
          }
        },
        onError: (e: any) => toast.error(e?.message),
      }
    );
  };

  if (myOrg) {
    return (
      <div className="rounded-lg border p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{myOrg.display_name}</div>
            <div className="text-xs text-muted-foreground capitalize">{myOrg.category}</div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate(`/org/${myOrg.slug}`)}>
          Mở trang <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Building2 className="h-4 w-4 mr-2" />
          Đăng ký Tổ chức / Validator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Đăng ký entity nâng cao</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Loại</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button variant={entityType === "org" ? "default" : "outline"} size="sm"
                onClick={() => setEntityType("org")}>
                <Building2 className="h-4 w-4 mr-1" /> Organization
              </Button>
              <Button variant={entityType === "validator" ? "default" : "outline"} size="sm"
                onClick={() => setEntityType("validator")}>
                <ShieldCheck className="h-4 w-4 mr-1" /> Validator
              </Button>
            </div>
            {entityType === "validator" && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠ Yêu cầu Trust Tier ≥ T2 và stake tối thiểu 10,000 CLY
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">Tên hiển thị</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: FUN Foundation" />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="community">Community</SelectItem>
                <SelectItem value="dao">DAO</SelectItem>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="charity">Charity</SelectItem>
                <SelectItem value="protocol">Protocol</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Website (tuỳ chọn)</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label className="text-xs">Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={register.isPending}>
            {register.isPending ? "Đang xử lý..." : "Đăng ký"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
