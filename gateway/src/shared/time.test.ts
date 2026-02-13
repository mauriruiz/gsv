import { describe, it, expect } from "vitest";
import {
  resolveTimezone,
  formatTimeShort,
  formatTimeFull,
  formatEnvelope,
} from "./time";

describe("resolveTimezone", () => {
  it("returns valid IANA timezone as-is", () => {
    expect(resolveTimezone("America/Chicago")).toBe("America/Chicago");
    expect(resolveTimezone("Europe/London")).toBe("Europe/London");
    expect(resolveTimezone("UTC")).toBe("UTC");
  });

  it("falls back to UTC for invalid timezone", () => {
    expect(resolveTimezone("Not/A/Timezone")).toBe("UTC");
    expect(resolveTimezone("garbage")).toBe("UTC");
  });

  it("falls back to UTC for undefined/empty", () => {
    expect(resolveTimezone(undefined)).toBe("UTC");
    expect(resolveTimezone("")).toBe("UTC");
  });
});

describe("formatTimeShort", () => {
  it("formats time with timezone abbreviation", () => {
    const date = new Date("2026-02-13T15:30:00Z");
    const result = formatTimeShort(date, "UTC");
    expect(result).toContain("3:30");
    expect(result).toContain("PM");
    expect(result).toContain("UTC");
  });

  it("respects timezone", () => {
    const date = new Date("2026-02-13T15:30:00Z");
    const utcResult = formatTimeShort(date, "UTC");
    const chicagoResult = formatTimeShort(date, "America/Chicago");
    // Chicago is UTC-6, so 15:30 UTC = 9:30 AM CST
    expect(chicagoResult).toContain("9:30");
    expect(chicagoResult).toContain("AM");
  });
});

describe("formatTimeFull", () => {
  it("formats full date with day of week", () => {
    const date = new Date("2026-02-13T15:30:00Z");
    const result = formatTimeFull(date, "UTC");
    expect(result).toContain("Friday");
    expect(result).toContain("February");
    expect(result).toContain("2026");
    expect(result).toContain("3:30");
    expect(result).toContain("PM");
  });
});

describe("formatEnvelope", () => {
  const baseParams = {
    channel: "whatsapp",
    timestamp: new Date("2026-02-13T15:30:00Z"),
    timezone: "UTC",
  };

  it("formats DM envelope with channel and time", () => {
    const result = formatEnvelope("Hello", {
      ...baseParams,
      peerKind: "dm",
    });
    expect(result).toMatch(/^\[whatsapp · .+UTC\] Hello$/);
  });

  it("includes sender for group messages", () => {
    const result = formatEnvelope("Hello", {
      ...baseParams,
      peerKind: "group",
      sender: "Alice (+1555)",
    });
    expect(result).toContain("Alice (+1555)");
    expect(result).toMatch(/^\[whatsapp · .+ · Alice \(\+1555\)\] Hello$/);
  });

  it("omits sender for DM even if provided", () => {
    const result = formatEnvelope("Hello", {
      ...baseParams,
      peerKind: "dm",
      sender: "Alice",
    });
    expect(result).not.toContain("Alice");
  });

  it("omits sender when peerKind is undefined (defaults to no sender)", () => {
    const result = formatEnvelope("Hello", baseParams);
    expect(result).toMatch(/^\[whatsapp · .+\] Hello$/);
  });
});
