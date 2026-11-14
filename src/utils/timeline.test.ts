import { describe, expect, it } from "vitest";
import { buildRibbon, groupByYear, sessionDayLabel } from "./timeline";

describe("buildRibbon", () => {
  it("returns null when no file has a capture time", () => {
    expect(buildRibbon([{ created_at: null }, { created_at: "not a date" }])).toBeNull();
  });

  it("keeps ticks inside the strip and in order for a single-day session", () => {
    const ribbon = buildRibbon([
      { created_at: "2024-06-14T09:00:00" },
      { created_at: "2024-06-14T12:00:00" },
      { created_at: "2024-06-14T17:00:00" },
      { created_at: null },
    ])!;
    expect(ribbon.timed).toBe(3);
    expect(ribbon.ticks).toHaveLength(3);
    expect(ribbon.ticks[0]).toBeGreaterThan(0);
    expect(ribbon.ticks[2]).toBeLessThan(100);
    expect([...ribbon.ticks].sort((a, b) => a - b)).toEqual(ribbon.ticks);
  });

  it("merges files shot at the same moment and caps ticks at the resolution", () => {
    const same = Array.from({ length: 50 }, () => ({ created_at: "2019-01-01T00:00:00" }));
    expect(buildRibbon(same)!.ticks).toHaveLength(1);

    const many = Array.from({ length: 5000 }, (_, i) => ({
      created_at: new Date(Date.UTC(2024, 7, 14) + i * 40_000).toISOString(),
    }));
    expect(buildRibbon(many, 100)!.ticks.length).toBeLessThanOrEqual(101);
  });

  it("labels a multi-day session with its first and last day", () => {
    const ribbon = buildRibbon([{ created_at: "2024-06-03T18:20:00" }, { created_at: "2024-06-09T21:02:00" }])!;
    expect(ribbon.axis[0]).toBe("3 Haziran");
    expect(ribbon.axis[2]).toBe("9 Haziran");
  });
});

describe("sessionDayLabel", () => {
  it("formats single-day, same-month and cross-month sessions", () => {
    expect(sessionDayLabel({ date_start: "2024-06-14T09:12:00", date_end: "2024-06-14T17:48:00" }).main).toBe("14 Haz");
    expect(sessionDayLabel({ date_start: "2024-06-03T18:20:00", date_end: "2024-06-09T21:02:00" })).toEqual({
      main: "3–9 Haz",
      sub: "2024, 7 gün",
    });
    expect(sessionDayLabel({ date_start: "2024-08-30T10:00:00", date_end: "2024-09-02T10:00:00" }).main).toBe(
      "30 Ağu – 2 Eyl"
    );
    expect(sessionDayLabel({ date_start: null, date_end: null }).main).toBe("Tarihsiz");
  });
});

describe("groupByYear", () => {
  it("groups sessions by year, newest first, and skips undated ones", () => {
    const groups = groupByYear([
      { id: "a", date_start: "2019-01-01T00:00:00", date_end: null, suggested_path: "ARCHIVE/2019/EVERYDAY/2019-01" },
      { id: "b", date_start: "2024-07-01T00:00:00", date_end: "2024-07-03T00:00:00", suggested_path: "ARCHIVE/2024/X" },
      { id: "c", date_start: null, date_end: null, suggested_path: "REVIEW" },
    ]);
    expect(groups.map((g) => g.year)).toEqual([2024, 2019]);
    expect(groups[0].spans[0].left).toBeGreaterThan(49);
    expect(groups[0].spans[0].left).toBeLessThan(51);
    expect(groups[1].spans[0].label).toBe("2019-01");
  });
});
