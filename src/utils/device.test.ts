import { describe, expect, it } from "vitest";
import { destinationDir } from "./device";

describe("destinationDir", () => {
  it("files photos under Photos/<Device>", () => {
    expect(
      destinationDir("/Volumes/HDD", "ARCHIVE/2024/2024-06-14_Kumbet-Yaylasi", { kind: "photo", device: "Sony_a6700" })
    ).toBe("/Volumes/HDD/ARCHIVE/2024/2024-06-14_Kumbet-Yaylasi/Photos/Sony_a6700");
  });

  it("files videos under Videos/<Device>", () => {
    expect(destinationDir("/Volumes/HDD", "ARCHIVE/2024/EVERYDAY/2024-06", { kind: "video", device: "iPhone" })).toBe(
      "/Volumes/HDD/ARCHIVE/2024/EVERYDAY/2024-06/Videos/iPhone"
    );
  });

  it("falls back to Unknown_Device and never leaves spaces in the folder name", () => {
    expect(destinationDir("/r", "t", { kind: "photo", device: "" })).toBe("/r/t/Photos/Unknown_Device");
    expect(destinationDir("/r", "t", { kind: "photo", device: "Canon 6D" })).toBe("/r/t/Photos/Canon_6D");
  });
});
