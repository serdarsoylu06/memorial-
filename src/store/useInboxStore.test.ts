import { beforeEach, describe, expect, it } from "vitest";
import { useInboxStore } from "./useInboxStore";
import type { ScanResult } from "../types";

const emptyScan: ScanResult = { total_files: 0, sessions: [], unclassified: [] };

describe("scan approval lifecycle", () => {
  beforeEach(() => useInboxStore.getState().setScanResult(null));

  it("does not apply approval or rejection from a previous scan", () => {
    const store = useInboxStore.getState();
    store.approveSession("old-approved");
    store.rejectSession("old-rejected");
    store.setScanResult(emptyScan);
    expect(useInboxStore.getState().approvedSessions.size).toBe(0);
    expect(useInboxStore.getState().rejectedSessions.size).toBe(0);
    expect(useInboxStore.getState().selectedSession).toBeNull();
  });

  it("keeps approval and rejection mutually exclusive", () => {
    const store = useInboxStore.getState();
    store.approveSession("session");
    store.approveSession("session");
    expect(useInboxStore.getState().approvedSessions.size).toBe(1);
    store.rejectSession("session");
    expect(useInboxStore.getState().approvedSessions.has("session")).toBe(false);
    expect(useInboxStore.getState().rejectedSessions.has("session")).toBe(true);
    store.approveSession("session");
    expect(useInboxStore.getState().rejectedSessions.has("session")).toBe(false);
  });
});
