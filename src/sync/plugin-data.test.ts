import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "../settings/defaults";
import {
  createEmptyPluginData,
  mergePluginData,
  readLegacyAuthState,
} from "./plugin-data";

describe("readLegacyAuthState", () => {
  it("reads refresh token from legacy data.json auth blob", () => {
    expect(readLegacyAuthState({ refreshToken: "rt", accessToken: "at", expiresAt: 1 })).toEqual({
      refreshToken: "rt",
      accessToken: "at",
      expiresAt: 1,
    });
  });

  it("returns undefined when refresh token is missing", () => {
    expect(readLegacyAuthState({ accessToken: "at" })).toBeUndefined();
  });
});

describe("mergePluginData", () => {
  it("re-normalizes settings after merging stored plugin data", () => {
    const normalized = normalizeSettings(DEFAULT_SETTINGS);
    const merged = mergePluginData(
      {
        settings: {
          ...DEFAULT_SETTINGS,
          deltaIntervalMinutes: 999,
          appendBacklinkToTodo: "yes" as unknown as boolean,
        },
        index: {},
      },
      normalized
    );
    expect(merged.settings.deltaIntervalMinutes).toBe(60);
    expect(merged.settings.appendBacklinkToTodo).toBe(true);
  });

  it("re-normalizes legacy flat settings format", () => {
    const normalized = normalizeSettings(DEFAULT_SETTINGS);
    const merged = mergePluginData(
      { ...DEFAULT_SETTINGS, syncTag: "#custom", deltaIntervalMinutes: 0 },
      normalized
    );
    expect(merged.settings.syncTag).toBe("custom");
    expect(merged.settings.deltaIntervalMinutes).toBe(1);
    expect(merged.index).toEqual({});
  });

  it("creates empty data when raw is null", () => {
    const normalized = normalizeSettings(DEFAULT_SETTINGS);
    expect(mergePluginData(null, normalized)).toEqual(createEmptyPluginData(normalized));
  });

  it("stamps settingsVersion on merged data", () => {
    const normalized = normalizeSettings(DEFAULT_SETTINGS);
    const merged = mergePluginData({ index: {} }, normalized);
    expect(merged.settingsVersion).toBe(1);
  });
});
