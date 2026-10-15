/**
 * Ellipsis character appended when a notification preview is truncated.
 * Pure and deterministic.
 */
const NOTIFICATION_ELLIPSIS = "…";

/**
 * Default maximum character count for the notification preview.
 * Pure and deterministic.
 */
const DEFAULT_NOTIFICATION_CHARS = 100;

/**
 * The three rendered previews of an announcement, one per surface:
 * a phone lock/expanded view, a desktop view, and a short push notification.
 * Pure and deterministic.
 */
export interface AnnouncementPreviews {
  /** Full announcement text as shown on mobile. */
  readonly mobile: string;
  /** Full announcement text as shown on desktop. */
  readonly desktop: string;
  /** Short push-notification text, truncated with an ellipsis when cut. */
  readonly notification: string;
}

/**
 * Options controlling how the announcement previews are built.
 * Pure and deterministic.
 */
export interface AnnouncementPreviewOptions {
  /** Maximum characters for the notification preview (values below 1 clamp to 1). */
  readonly notificationChars?: number;
}

/**
 * Builds the notification preview by truncating to at most `limit` characters,
 * appending an ellipsis (counted within the limit) only when the text is cut.
 * Trailing whitespace before the ellipsis is removed for a cleaner tail.
 * Pure and deterministic.
 */
const buildNotificationPreview = (text: string, limit: number): string => {
  if (text.length <= limit) {
    return text;
  }
  const head = text.slice(0, limit - 1).replace(/\s+$/u, "");
  return `${head}${NOTIFICATION_ELLIPSIS}`;
};

/**
 * Builds multi-device previews (mobile, desktop, notification) of an announcement.
 * Mobile and desktop show the full text; the notification is truncated to
 * `notificationChars` (default 100) with a trailing ellipsis when the text is cut.
 * The notification never exceeds `notificationChars`, which is clamped to at least 1.
 * Pure and deterministic.
 */
export const buildAnnouncementPreviews = (
  text: string,
  options: AnnouncementPreviewOptions = {},
): AnnouncementPreviews => {
  const requested = options.notificationChars ?? DEFAULT_NOTIFICATION_CHARS;
  const limit = requested < 1 ? 1 : Math.floor(requested);
  return {
    mobile: text,
    desktop: text,
    notification: buildNotificationPreview(text, limit),
  };
};
