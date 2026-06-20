import { describe, expect, it } from "vitest";
import {
  parseInboundRouteHeader,
  parseInboundRouteLine,
  parseWikilinkTarget,
} from "./inbound-route";

describe("inbound-route", () => {
  it("parses wikilink file and heading", () => {
    expect(parseWikilinkTarget("[[周会笔记#本周待办]]")).toEqual({
      filePart: "周会笔记",
      heading: "本周待办",
    });
    expect(parseWikilinkTarget("[[周会笔记 ## 本周待办]]")).toEqual({
      filePart: "周会笔记",
      heading: "本周待办",
    });
    expect(parseWikilinkTarget("[[Projects/Weekly.md]]")).toEqual({
      filePart: "Projects/Weekly.md",
    });
  });

  it("parses wikilink route header at note start", () => {
    const body = "[[周会笔记#本周待办]]\n---\n用户真实备注";
    expect(parseInboundRouteHeader(body)).toEqual({
      hasRoute: true,
      linkRaw: "[[周会笔记#本周待办]]",
      filePart: "周会笔记",
      heading: "本周待办",
      userNote: "用户真实备注",
    });
  });

  it("parses page: route header", () => {
    expect(parseInboundRouteLine("page: [[周会笔记#本周待办]]")).toEqual({
      linkRaw: "page: [[周会笔记#本周待办]]",
      filePart: "周会笔记",
      heading: "本周待办",
    });
    expect(parseInboundRouteLine("page: Projects/Weekly.md")).toEqual({
      linkRaw: "page: Projects/Weekly.md",
      filePart: "Projects/Weekly.md",
    });
    expect(parseInboundRouteLine("page: 周会笔记#待办")).toEqual({
      linkRaw: "page: 周会笔记#待办",
      filePart: "周会笔记",
      heading: "待办",
    });

    const body = "page: [[Capture/Inbox.md]]\n---\n手机捕获";
    expect(parseInboundRouteHeader(body)).toEqual({
      hasRoute: true,
      linkRaw: "page: [[Capture/Inbox.md]]",
      filePart: "Capture/Inbox.md",
      heading: undefined,
      userNote: "手机捕获",
    });
  });

  it("ignores route-like text not at the start", () => {
    const body = "先写备注\n[[周会笔记]]\n---\n尾部";
    expect(parseInboundRouteHeader(body).hasRoute).toBe(false);
  });

  it("ignores tag: lines without page route", () => {
    const body = "tag: #obsidian\npage: [[Note.md]]\n---\n正文";
    expect(parseInboundRouteHeader(body).hasRoute).toBe(false);
  });
});
