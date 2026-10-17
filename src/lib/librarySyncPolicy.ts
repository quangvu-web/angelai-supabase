// Requested cadence is not proof of the partner's active scheduler configuration.
export const LIBRARY_SYNC_POLICY = {
  requestedIntervalHours: 24,
  scheduleVerified: false,
  scheduleReportedPublished: true,
  partnerControlConnected: false,
  lastRunAt: null,
  nextRunAt: null,
} as const;