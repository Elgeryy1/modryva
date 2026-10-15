import { describe, expect, it } from "vitest";
import { requiresPeerReview } from "./peer-admin-review.js";

describe("requiresPeerReview", () => {
  it("requires review when an admin sanctions another admin", () => {
    expect(
      requiresPeerReview({ actorIsAdmin: true, targetIsAdmin: true }),
    ).toEqual({
      required: true,
      reason:
        "⚠️ Un administrador sancionó a otro administrador. Se requiere revisión obligatoria antes de aplicar la medida.",
    });
  });

  it("does not require review when an admin sanctions a normal user", () => {
    expect(
      requiresPeerReview({ actorIsAdmin: true, targetIsAdmin: false }),
    ).toEqual({
      required: false,
      reason:
        "La sanción recae sobre un usuario normal; no hace falta revisión entre pares.",
    });
  });

  it("does not require review when a normal user sanctions an admin", () => {
    expect(
      requiresPeerReview({ actorIsAdmin: false, targetIsAdmin: true }),
    ).toEqual({
      required: false,
      reason:
        "El autor no es administrador, así que no aplica la revisión entre administradores.",
    });
  });

  it("does not require review when neither party is an admin", () => {
    expect(
      requiresPeerReview({ actorIsAdmin: false, targetIsAdmin: false }),
    ).toEqual({
      required: false,
      reason:
        "Ni el autor ni el objetivo son administradores; no aplica revisión obligatoria.",
    });
  });

  it("only sets required to true for the admin-on-admin case", () => {
    const required = [
      { actorIsAdmin: true, targetIsAdmin: true },
      { actorIsAdmin: true, targetIsAdmin: false },
      { actorIsAdmin: false, targetIsAdmin: true },
      { actorIsAdmin: false, targetIsAdmin: false },
    ].map((input) => requiresPeerReview(input).required);
    expect(required).toEqual([true, false, false, false]);
  });

  it("returns a non-empty Spanish reason in every branch", () => {
    const inputs = [
      { actorIsAdmin: true, targetIsAdmin: true },
      { actorIsAdmin: true, targetIsAdmin: false },
      { actorIsAdmin: false, targetIsAdmin: true },
      { actorIsAdmin: false, targetIsAdmin: false },
    ];
    for (const input of inputs) {
      expect(requiresPeerReview(input).reason.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for repeated identical inputs", () => {
    const input = { actorIsAdmin: true, targetIsAdmin: true };
    const first = requiresPeerReview(input);
    const second = requiresPeerReview(input);
    expect(first).toEqual(second);
  });

  it("ignores object identity and depends only on the boolean values", () => {
    const a = requiresPeerReview({ actorIsAdmin: true, targetIsAdmin: true });
    const b = requiresPeerReview({ targetIsAdmin: true, actorIsAdmin: true });
    expect(a).toEqual(b);
  });
});
