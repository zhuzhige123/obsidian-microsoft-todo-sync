import { describe, expect, it } from "vitest";
import {
  findMtdCommentMatchesInLine,
  parseMtdComment,
  placeMtdComment,
  serializeMtdComment,
  stripMtdComment,
  upsertMtdComment,
} from "./mtd-comment";

describe("mtd-comment", () => {
  it("parses id graph reminder and myday", () => {
    const line = '- [ ] Task <!-- mtd:id=mtd-abc graph=g1 reminder=2026-06-09T09:00 myday -->';
    expect(parseMtdComment(line)).toEqual({
      id: "mtd-abc",
      graph: "g1",
      reminder: "2026-06-09T09:00",
      myday: true,
    });
  });

  it("serializes without graph id in notes", () => {
    const serialized = serializeMtdComment({ id: "mtd-x", graph: "g2" });
    expect(serialized).toBe("<!-- mtd:id=mtd-x -->");
    expect(stripMtdComment(`line ${serialized}`)).toBe("line");
  });

  it("strips mid-line mtd comments without leaving double spaces", () => {
    const line =
      "- [ ] Fix sink #GTD/home <!-- mtd:id=mtd-x --> 🔽 🛫 2026-09-28";
    expect(stripMtdComment(line)).toBe("- [ ] Fix sink #GTD/home 🔽 🛫 2026-09-28");
  });

  it("places mtd comment before Tasks emoji metadata", () => {
    const placed = placeMtdComment(
      "- [ ] Fix sink #GTD/home 🔽 🛫 2026-09-28",
      "<!-- mtd:id=mtd-x -->"
    );
    expect(placed).toBe(
      "- [ ] Fix sink #GTD/home <!-- mtd:id=mtd-x --> 🔽 🛫 2026-09-28"
    );
  });

  it("upserts trailing legacy comments into Tasks-compatible position", () => {
    const legacy =
      "- [ ] Fix sink #GTD/home 🔽 🛫 2026-09-28 <!-- mtd:id=mtd-old -->";
    const updated = upsertMtdComment(legacy, { id: "mtd-new" });
    expect(updated).toBe(
      "- [ ] Fix sink #GTD/home <!-- mtd:id=mtd-new --> 🔽 🛫 2026-09-28"
    );
  });

  it("upserts and clears graph on unlink", () => {
    const line = '- [ ] Task <!-- mtd:id=mtd-abc graph=g1 -->';
    const unlinked = upsertMtdComment(line, { graph: undefined });
    expect(parseMtdComment(unlinked).graph).toBeUndefined();
    expect(parseMtdComment(unlinked).id).toBe("mtd-abc");
  });

  it("finds inline mtd comments on a task line", () => {
    const line = "- [ ] Task #msd <!-- mtd:id=mtd-d0cb0881 -->";
    const matches = findMtdCommentMatchesInLine(line);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.raw).toBe("<!-- mtd:id=mtd-d0cb0881 -->");
    expect(matches[0]?.index).toBeGreaterThan(0);
  });

  it("parses graph id broken by accidental whitespace", () => {
    const line =
      '- [ ] Task <!-- mtd:id=mtd-abc graph=AAAAbbbb CCCCdddd reminder=2026-06-09T09:00 -->';
    expect(parseMtdComment(line).graph).toBe("AAAAbbbbCCCCdddd");
    expect(parseMtdComment(line).reminder).toBe("2026-06-09T09:00");
  });
});
