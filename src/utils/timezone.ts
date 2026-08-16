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

/** User's local zone for Graph `dateTimeTimeZone` (wall-clock time, not UTC). */
export function getGraphTimeZone(): string {
  const iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return IANA_TO_WINDOWS[iana] ?? iana;
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
