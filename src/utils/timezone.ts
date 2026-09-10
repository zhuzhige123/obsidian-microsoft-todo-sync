/** Map common IANA zones to Windows names expected by Microsoft Graph To Do. */
const IANA_TO_WINDOWS: Record<string, string> = {
  "Asia/Shanghai": "China Standard Time",
  "Asia/Chongqing": "China Standard Time",
  "Asia/Hong_Kong": "China Standard Time",
  "Asia/Taipei": "Taipei Standard Time",
  "Asia/Singapore": "Singapore Standard Time",
  "Asia/Tokyo": "Tokyo Standard Time",
  "Asia/Seoul": "Korea Standard Time",
  "America/Los_Angeles": "Pacific Standard Time",
  "America/New_York": "Eastern Standard Time",
  "Europe/London": "GMT Standard Time",
  "Europe/Paris": "W. Europe Standard Time",
  UTC: "UTC",
};

/** Reverse map for inbound Graph `timeZone` values that are not already local. */
const WINDOWS_TO_IANA: Record<string, string> = {
  "China Standard Time": "Asia/Shanghai",
  "Taipei Standard Time": "Asia/Taipei",
  "Singapore Standard Time": "Asia/Singapore",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "Pacific Standard Time": "America/Los_Angeles",
  "Eastern Standard Time": "America/New_York",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Paris",
  "Greenwich Standard Time": "UTC",
  UTC: "UTC",
};

export type GraphDateTimeTimeZone = {
  dateTime?: string;
  timeZone?: string;
};

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getLocalIanaTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** User's local zone for Graph `dateTimeTimeZone` (wall-clock time, not UTC). */
export function getGraphTimeZone(): string {
  const iana = getLocalIanaTimeZone();
  return IANA_TO_WINDOWS[iana] ?? iana;
}

/** Prefer header so Graph returns dateTimeTimeZone fields in the user's zone. */
export function getOutlookTimezonePreferHeader(): string {
  return `outlook.timezone="${getGraphTimeZone()}"`;
}

/** `2026-06-10T12:00` → `2026-06-10T12:00:00.0000000` */
export function normalizeGraphLocalDateTime(iso: string): string {
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}:\d{2}))?/);
  if (!match) {
    return iso;
  }
  const [, date, time] = match;
  if (!time) {
    return `${date}T09:00:00.0000000`;
  }
  const [hour, minute] = time.split(":");
  return `${date}T${hour.padStart(2, "0")}:${minute}:00.0000000`;
}

/**
 * Convert Graph `dateTimeTimeZone` to local wall-clock ISO (`YYYY-MM-DDTHH:mm`).
 * Graph often returns UTC unless Prefer: outlook.timezone is honored.
 */
export function fromGraphDateTimeTimeZone(
  value?: GraphDateTimeTimeZone
): string | undefined {
  if (!value?.dateTime) {
    return undefined;
  }
  const parsed = parseGraphDateTime(value.dateTime);
  if (!parsed) {
    return undefined;
  }

  const reportedZone = value.timeZone?.trim() || "UTC";
  if (isAlreadyLocalWallClock(reportedZone)) {
    return formatWallIso(parsed);
  }

  const sourceIana = resolveIanaTimeZone(reportedZone);
  const instant =
    sourceIana === "UTC"
      ? new Date(
          Date.UTC(
            parsed.year,
            parsed.month - 1,
            parsed.day,
            parsed.hour,
            parsed.minute,
            parsed.second
          )
        )
      : wallClockInTimeZoneToUtcDate(parsed, sourceIana);

  return formatLocalWallIso(instant);
}

function isAlreadyLocalWallClock(reportedZone: string): boolean {
  const localWindows = getGraphTimeZone();
  const localIana = getLocalIanaTimeZone();
  if (reportedZone === localWindows || reportedZone === localIana) {
    return true;
  }
  return WINDOWS_TO_IANA[reportedZone] === localIana;
}

function resolveIanaTimeZone(reportedZone: string): string {
  if (
    reportedZone === "UTC" ||
    reportedZone === "Etc/UTC" ||
    reportedZone === "GMT" ||
    reportedZone === "Greenwich Standard Time"
  ) {
    return "UTC";
  }
  return WINDOWS_TO_IANA[reportedZone] ?? reportedZone;
}

function parseGraphDateTime(dateTime: string): WallParts | undefined {
  const match = dateTime.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!match) {
    return undefined;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? "0"),
    minute: Number(match[5] ?? "0"),
    second: Number(match[6] ?? "0"),
  };
}

function formatWallIso(parts: WallParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

function formatLocalWallIso(date: Date): string {
  return formatWallIso(getWallPartsInTimeZone(date, getLocalIanaTimeZone()));
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Find the UTC instant whose wall clock in `timeZone` equals `parts`. */
function wallClockInTimeZoneToUtcDate(parts: WallParts, timeZone: string): Date {
  let utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  for (let i = 0; i < 3; i += 1) {
    const shown = getWallPartsInTimeZone(new Date(utcMs), timeZone);
    const wantedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const shownAsUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second
    );
    utcMs += wantedAsUtc - shownAsUtc;
  }
  return new Date(utcMs);
}

function getWallPartsInTimeZone(date: Date, timeZone: string): WallParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number(value ?? "0");
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}
