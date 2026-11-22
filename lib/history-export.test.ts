import { describe, expect, it, vi } from "vitest";
import {
  buildHistoryCsvFilename,
  CSV_HEADERS,
  downloadHistoryCsv,
  escapeCsvCell,
  eventsToCsv,
  formatCsvDecimalAmount,
} from "./history-export";
import type { LendingEvent } from "./events";

const sampleEvent: LendingEvent = {
  id: "ev-1",
  kind: "deposit",
  user: "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH",
  amount: BigInt(125_000_000), // 12.5 XLM
  after: BigInt(225_000_000),
  timestamp: 1_700_000_000, // 2023-11-14T22:13:20.000Z
  ledger: 1000,
  txHash: "a".repeat(64),
};

describe("lib/history-export", () => {
  describe("escapeCsvCell", () => {
    it("neutralises =cmd and other formula injection prefixes (=, +, -, @)", () => {
      expect(escapeCsvCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
      expect(escapeCsvCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
      expect(escapeCsvCell("-100+200")).toBe("'-100+200");
      expect(escapeCsvCell("@HYPERLINK(\"http://evil\")")).toBe(
        "\"'@HYPERLINK(\"\"http://evil\"\")\""
      );
    });

    it("quotes commas, double quotes, and newlines according to RFC-4180", () => {
      expect(escapeCsvCell("value,with,commas")).toBe('"value,with,commas"');
      expect(escapeCsvCell('value with "quotes"')).toBe('"value with ""quotes"""');
      expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
      expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
    });

    it("leaves normal alphanumeric cells unquoted", () => {
      expect(escapeCsvCell("deposit")).toBe("deposit");
      expect(escapeCsvCell("12.5")).toBe("12.5");
      expect(escapeCsvCell("XLM")).toBe("XLM");
    });
  });

  describe("formatCsvDecimalAmount", () => {
    it("formats base units into ungrouped decimal strings", () => {
      expect(formatCsvDecimalAmount(BigInt(0))).toBe("0");
      expect(formatCsvDecimalAmount(BigInt(50_000_000))).toBe("5");
      expect(formatCsvDecimalAmount(BigInt(12_345_678))).toBe("1.2345678");
      expect(formatCsvDecimalAmount(BigInt(100_000_000_000_000))).toBe("10000000");
    });
  });

  describe("eventsToCsv", () => {
    it("produces RFC-4180 CSV with required columns and CRLF line breaks", () => {
      const csv = eventsToCsv([sampleEvent]);
      const lines = csv.split("\r\n");

      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(CSV_HEADERS.join(","));
      expect(lines[1]).toBe(
        `2023-11-14T22:13:20.000Z,deposit,XLM,12.5,125000000,${"a".repeat(64)}`
      );
    });

    it("neutralises formula injection and escapes commas/quotes in event fields", () => {
      const maliciousEvent: LendingEvent = {
        ...sampleEvent,
        txHash: '=cmd,with"quote\nand_newline',
      };
      const csv = eventsToCsv([maliciousEvent], { asset: "+XLM,TEST" });
      const lines = csv.split("\r\n");

      expect(lines[1]).toContain('"\'+XLM,TEST"');
      expect(lines[1]).toContain('"\'=cmd,with""quote\nand_newline"');
    });
  });

  describe("buildHistoryCsvFilename", () => {
    it("formats filename as stellarlend-history-<short address>-<YYYY-MM-DD>.csv", () => {
      const date = new Date("2025-03-15T10:20:30Z");
      const filename = buildHistoryCsvFilename(
        "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH",
        date
      );
      expect(filename).toBe("stellarlend-history-ga5w-skyh-2025-03-15.csv");
    });
  });

  describe("downloadHistoryCsv", () => {
    it("creates a Blob and triggers download anchor click", () => {
      const createObjectURLSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:http://localhost/mock-csv");
      const revokeObjectURLSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {});
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});

      const filename = downloadHistoryCsv(
        [sampleEvent],
        "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH",
        { now: new Date("2025-03-15T00:00:00Z") }
      );

      expect(filename).toBe("stellarlend-history-ga5w-skyh-2025-03-15.csv");
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
      expect(blobArg).toBeInstanceOf(Blob);
      expect(blobArg.type).toBe("text/csv;charset=utf-8;");
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:http://localhost/mock-csv");

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      clickSpy.mockRestore();
    });
  });
});
