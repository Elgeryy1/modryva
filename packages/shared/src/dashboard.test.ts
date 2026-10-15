import { describe, expect, it } from "vitest";
import { summarizeDashboard } from "./dashboard.js";

describe("summarizeDashboard", () => {
  it("projects counts into labelled cards", () => {
    const data = summarizeDashboard(
      {
        updates: 10,
        auditEvents: 25,
        activeSanctions: 2,
        openTickets: 3,
        scheduledPosts: 1,
        aiTokens: 500,
      },
      "2026-06-28T00:00:00.000Z",
    );

    expect(data.generatedAt).toBe("2026-06-28T00:00:00.000Z");
    expect(data.cards.map((card) => card.key)).toEqual([
      "updates",
      "audit",
      "sanctions",
      "tickets",
      "posts",
      "ai",
    ]);
    expect(data.cards.find((card) => card.key === "ai")?.value).toBe(500);
  });
});
