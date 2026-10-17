import { CoreLayout } from "@/components/layouts/CoreLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface PageProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  showPhase2?: boolean;
  requireRole?: boolean;
}

export function CorePageShell({ title, subtitle, children, showPhase2 = true, requireRole = true }: PageProps) {
  const { t } = useLanguage();
  return (
    <CoreLayout requireRole={requireRole}>
      <div className="container mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {showPhase2 && (
            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
              {t("core.phase2")}
            </Badge>
          )}
        </div>
        {children}
      </div>
    </CoreLayout>
  );
}

export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4 space-y-1">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
