/**
 * Time formatting and message envelope utilities.
 *
 * Timezone handling uses Intl.DateTimeFormat which is available in
 * Cloudflare Workers (V8-based). No external dependencies needed.
 */

/**
 * Validate an IANA timezone string.
 * Returns the timezone if valid, "UTC" otherwise.
 */
export function resolveTimezone(tz: string | undefined): string {
  if (!tz) return "UTC";
  try {
    // Intl.DateTimeFormat throws on invalid timezone
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/**
 * Format a Date in a human-readable way for the given timezone.
 *
 * Returns e.g. "3:30 PM CST" or "15:30 UTC".
 * Compact format for envelopes — time + short timezone abbreviation.
 */
export function formatTimeShort(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  return formatter.format(date);
}

/**
 * Format a Date in a full human-readable way for the given timezone.
 *
 * Returns e.g. "Thursday, February 13th, 2026 — 3:30 PM CST".
 * Used for cron status and cron execution injection.
 */
export function formatTimeFull(date: Date, timezone: string): string {
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  });
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });

  const dayOfWeek = dayFormatter.format(date);
  const datePart = dateFormatter.format(date);
  const timePart = timeFormatter.format(date);

  return `${dayOfWeek}, ${datePart} — ${timePart}`;
}

export type EnvelopeParams = {
  channel: string;
  timestamp: Date;
  timezone: string;
  /** Peer kind (dm, group, channel, thread). */
  peerKind?: string;
  /** Sender label for group/channel messages. Omitted for DMs. */
  sender?: string;
};

/**
 * Wrap a message in an envelope header with channel + timestamp metadata.
 *
 * DM:    `[whatsapp 3:30 PM CST] Hello`
 * Group: `[whatsapp 3:30 PM CST · Alice (+1555...)] Hello`
 */
export function formatEnvelope(text: string, params: EnvelopeParams): string {
  const time = formatTimeShort(params.timestamp, params.timezone);
  const parts = [params.channel, time];

  // Include sender label for non-DM contexts
  if (params.sender && params.peerKind && params.peerKind !== "dm") {
    parts.push(params.sender);
  }

  return `[${parts.join(" · ")}] ${text}`;
}
