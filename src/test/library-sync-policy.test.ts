import { describe, expect, it } from "vitest";
import { LIBRARY_SYNC_POLICY } from "@/lib/librarySyncPolicy";

describe("partner library sync policy", () => {
  it("requests one run every 24 hours, not every six hours", () => {
    expect(LIBRARY_SYNC_POLICY.requestedIntervalHours).toBe(24);
  });
  it("does not claim an external schedule or runs have been verified", () => {
    expect(LIBRARY_SYNC_POLICY.scheduleVerified).toBe(false);
    expect(LIBRARY_SYNC_POLICY.lastRunAt).toBeNull();
    expect(LIBRARY_SYNC_POLICY.nextRunAt).toBeNull();
  });
  it("keeps a reported published daily schedule separate from verification", () => {
    expect(LIBRARY_SYNC_POLICY.scheduleReportedPublished).toBe(true);
    expect(LIBRARY_SYNC_POLICY.scheduleVerified).toBe(false);
  });
  it("does not enable execution without a partner control connection", () => {
    expect(LIBRARY_SYNC_POLICY.partnerControlConnected).toBe(false);
  });
});
