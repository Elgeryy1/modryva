import { describe, expect, it } from "vitest";
import { buildAnnouncementPreviews } from "./announcement-preview.js";

describe("buildAnnouncementPreviews", () => {
  it("shows the full text on mobile and desktop", () => {
    const previews = buildAnnouncementPreviews("Hola equipo");
    expect(previews.mobile).toBe("Hola equipo");
    expect(previews.desktop).toBe("Hola equipo");
  });

  it("keeps notification identical when text is within the limit", () => {
    const previews = buildAnnouncementPreviews("Corto");
    expect(previews.notification).toBe("Corto");
  });

  it("does not truncate when length equals the limit exactly", () => {
    const previews = buildAnnouncementPreviews("abcde", {
      notificationChars: 5,
    });
    expect(previews.notification).toBe("abcde");
  });

  it("truncates to exactly the limit including the ellipsis when cut", () => {
    const previews = buildAnnouncementPreviews("abcdefghijkl", {
      notificationChars: 5,
    });
    expect(previews.notification).toBe("abcd…");
    expect(previews.notification.length).toBe(5);
  });

  it("truncates when the text is one character over the limit", () => {
    const previews = buildAnnouncementPreviews("abcdef", {
      notificationChars: 5,
    });
    expect(previews.notification).toBe("abcd…");
  });

  it("trims trailing whitespace before appending the ellipsis", () => {
    const previews = buildAnnouncementPreviews("abc defghij", {
      notificationChars: 5,
    });
    expect(previews.notification).toBe("abc…");
  });

  it("defaults the notification limit to 100 characters", () => {
    const long = "x".repeat(150);
    const previews = buildAnnouncementPreviews(long);
    expect(previews.notification.length).toBe(100);
    expect(previews.notification.endsWith("…")).toBe(true);
    expect(previews.mobile).toBe(long);
  });

  it("returns empty previews for empty text", () => {
    expect(buildAnnouncementPreviews("")).toEqual({
      mobile: "",
      desktop: "",
      notification: "",
    });
  });

  it("clamps a non-positive limit to 1", () => {
    const previews = buildAnnouncementPreviews("hello", {
      notificationChars: 0,
    });
    expect(previews.notification).toBe("…");
  });

  it("is deterministic across repeated calls", () => {
    const first = buildAnnouncementPreviews("Anuncio importante", {
      notificationChars: 10,
    });
    const second = buildAnnouncementPreviews("Anuncio importante", {
      notificationChars: 10,
    });
    expect(first).toEqual(second);
  });
});
