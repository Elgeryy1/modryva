import { describe, expect, it } from "vitest";
import { computeCollectiveReward } from "./collective-rewards.js";

describe("computeCollectiveReward", () => {
  it("grants the shared reward when improvement meets the default threshold exactly", () => {
    expect(computeCollectiveReward({ improvement: 10 })).toEqual({
      earned: true,
      rewardPerMember: 50,
      message: "¡El grupo mejoró! Todos reciben 50 fichas 🎉",
    });
  });

  it("grants the shared reward when improvement exceeds the default threshold", () => {
    expect(computeCollectiveReward({ improvement: 25 })).toEqual({
      earned: true,
      rewardPerMember: 50,
      message: "¡El grupo mejoró! Todos reciben 50 fichas 🎉",
    });
  });

  it("withholds the reward when improvement is below the default threshold", () => {
    expect(computeCollectiveReward({ improvement: 9 })).toEqual({
      earned: false,
      rewardPerMember: 0,
      message: "El grupo aún no alcanza la meta. ¡Sigan mejorando juntos! 💪",
    });
  });

  it("honors custom threshold and reward tunables", () => {
    expect(
      computeCollectiveReward(
        { improvement: 3 },
        { threshold: 3, reward: 100 },
      ),
    ).toEqual({
      earned: true,
      rewardPerMember: 100,
      message: "¡El grupo mejoró! Todos reciben 100 fichas 🎉",
    });
  });

  it("withholds against a custom threshold that is not reached", () => {
    expect(
      computeCollectiveReward(
        { improvement: 2 },
        { threshold: 3, reward: 100 },
      ),
    ).toEqual({
      earned: false,
      rewardPerMember: 0,
      message: "El grupo aún no alcanza la meta. ¡Sigan mejorando juntos! 💪",
    });
  });

  it("treats a regression (negative improvement) as unearned", () => {
    expect(computeCollectiveReward({ improvement: -5 })).toEqual({
      earned: false,
      rewardPerMember: 0,
      message: "El grupo aún no alcanza la meta. ¡Sigan mejorando juntos! 💪",
    });
  });

  it("treats non-finite improvement as zero progress", () => {
    expect(computeCollectiveReward({ improvement: Number.NaN })).toEqual({
      earned: false,
      rewardPerMember: 0,
      message: "El grupo aún no alcanza la meta. ¡Sigan mejorando juntos! 💪",
    });
  });

  it("falls back to the default threshold when a negative threshold is supplied", () => {
    expect(
      computeCollectiveReward({ improvement: 8 }, { threshold: -1 }),
    ).toEqual({
      earned: false,
      rewardPerMember: 0,
      message: "El grupo aún no alcanza la meta. ¡Sigan mejorando juntos! 💪",
    });
  });

  it("falls back to the default reward when a non-finite reward is supplied", () => {
    expect(
      computeCollectiveReward(
        { improvement: 12 },
        { reward: Number.POSITIVE_INFINITY },
      ),
    ).toEqual({
      earned: true,
      rewardPerMember: 50,
      message: "¡El grupo mejoró! Todos reciben 50 fichas 🎉",
    });
  });

  it("treats an empty options object like defaults", () => {
    expect(computeCollectiveReward({ improvement: 100 }, {})).toEqual({
      earned: true,
      rewardPerMember: 50,
      message: "¡El grupo mejoró! Todos reciben 50 fichas 🎉",
    });
  });

  it("is deterministic for identical inputs", () => {
    const first = computeCollectiveReward(
      { improvement: 15 },
      { threshold: 12, reward: 30 },
    );
    const second = computeCollectiveReward(
      { improvement: 15 },
      { threshold: 12, reward: 30 },
    );
    expect(first).toEqual(second);
    expect(first).toEqual({
      earned: true,
      rewardPerMember: 30,
      message: "¡El grupo mejoró! Todos reciben 30 fichas 🎉",
    });
  });
});
