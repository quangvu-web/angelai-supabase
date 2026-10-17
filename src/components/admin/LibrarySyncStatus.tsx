import { AlertCircle, CalendarClock, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LIBRARY_SYNC_POLICY } from "@/lib/librarySyncPolicy";

export default function LibrarySyncStatus() {
  const { t, formatNumber } = useLanguage();

  return (
    <section aria-labelledby="library-sync-heading" className="mb-6 border-y border-border py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="library-sync-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <CalendarClock className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          {t("librarySync.title")}
        </h2>
        <span className="flex items-center gap-2 text-sm font-medium text-foreground-muted">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("librarySync.notConnected")}
        </span>
      </div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-foreground-muted">{t("librarySync.requested")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {t("librarySync.daily", { hours: formatNumber(LIBRARY_SYNC_POLICY.requestedIntervalHours) })}
          </dd>
        </div>
        <div>
          <dt className="text-foreground-muted">{t("librarySync.lastRun")}</dt>
          <dd className="mt-1 text-foreground">{t("librarySync.unknown")}</dd>
        </div>
        <div>
          <dt className="text-foreground-muted">{t("librarySync.nextRun")}</dt>
          <dd className="mt-1 text-foreground">{t("librarySync.unknown")}</dd>
        </div>
      </dl>
      {LIBRARY_SYNC_POLICY.scheduleReportedPublished && (
        <p className="mt-4 text-sm text-foreground-muted">{t("librarySync.reportedDaily")}</p>
      )}
      <p id="library-sync-blocked" role="status" className="mt-2 text-sm text-foreground-muted">
        {t("librarySync.connectionRequired")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={!LIBRARY_SYNC_POLICY.partnerControlConnected} aria-describedby="library-sync-blocked">
          <RefreshCw aria-hidden="true" />{t("librarySync.syncNow")}
        </Button>
        <Button asChild variant="link" className="h-auto max-w-full whitespace-normal px-0 text-start">
          <a href="https://docs.fun.rich/admin" target="_blank" rel="noopener noreferrer">
            {t("librarySync.openDocs")}<ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>
  );
}