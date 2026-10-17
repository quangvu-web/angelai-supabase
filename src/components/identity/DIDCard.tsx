import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, Wallet, ShieldCheck } from "lucide-react";
import type { DIDRecord } from "@/hooks/useDID";

const LEVEL_META = [
  { label: "L0 — Anonymous", desc: "guest / wallet only" },
  { label: "L1 — Basic", desc: "email / phone / profile" },
  { label: "L2 — Verified", desc: "stronger verification" },
  { label: "L3 — Trusted", desc: "SBT + clean history" },
  { label: "L4 — Core", desc: "contributor / curator" },
];

export function DIDCard({ did }: { did: DIDRecord }) {
  const lv = LEVEL_META[did.did_level] ?? LEVEL_META[0];
  const v = did.verification_state || {};

  return (
    <Card className="overflow-hidden border bg-gradient-to-br from-background via-background to-amber-500/5">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span className="text-sm uppercase tracking-wide text-muted-foreground">DID</span>
          </div>
          <Badge variant="outline" className="text-xs">{did.entity_type}</Badge>
        </div>

        <div className="space-y-1">
          <div className="font-mono text-sm break-all">{did.did}</div>
          <div className="text-xs text-muted-foreground">
            {lv.label} · {lv.desc}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Row icon={<ShieldCheck className="h-3 w-3" />} label="Email" ok={v.email_verified} />
          <Row icon={<ShieldCheck className="h-3 w-3" />} label="Phone" ok={v.phone_verified} />
          <Row icon={<Wallet className="h-3 w-3" />} label="Wallet" ok={v.wallet_linked || !!did.wallet_address} />
          <Row icon={<ShieldCheck className="h-3 w-3" />} label="KYC" ok={(v.kyc_level || 0) >= 1} />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ icon, label, ok }: { icon: React.ReactNode; label: string; ok?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
      {icon}
      <span>{label}</span>
      <span className="ml-auto">{ok ? "✓" : "—"}</span>
    </div>
  );
}
