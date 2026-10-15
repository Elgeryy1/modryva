import { describe, expect, it } from "vitest";
import { computeDeadlineReminders } from "./deadline-reminders.js";

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("computeDeadlineReminders", () => {
  it("returns empty lists for no tasks", () => {
    expect(computeDeadlineReminders([], 1_000_000)).toEqual({
      overdue: [],
      soon: [],
    });
  });

  it("marks strictly past-due tasks as overdue in input order", () => {
    const now = 1_000_000;
    const result = computeDeadlineReminders(
      [
        { title: "Proyecto", dueMs: now - 5 },
        { title: "Examen", dueMs: now - 1 },
      ],
      now,
    );
    expect(result).toEqual({ overdue: ["Proyecto", "Examen"], soon: [] });
  });

  it("treats a task due exactly now as soon with inMs 0, not overdue", () => {
    const now = 1_000_000;
    const result = computeDeadlineReminders(
      [{ title: "Tarea", dueMs: now }],
      now,
    );
    expect(result).toEqual({
      overdue: [],
      soon: [{ title: "Tarea", inMs: 0 }],
    });
  });

  it("includes tasks within the default 24h window and excludes those beyond", () => {
    const now = 1_000_000;
    const result = computeDeadlineReminders(
      [
        { title: "Cerca", dueMs: now + HOUR },
        { title: "Lejos", dueMs: now + 2 * DAY },
      ],
      now,
    );
    expect(result).toEqual({
      overdue: [],
      soon: [{ title: "Cerca", inMs: HOUR }],
    });
  });

  it("includes a task exactly on the window boundary", () => {
    const now = 1_000_000;
    const result = computeDeadlineReminders(
      [{ title: "Borde", dueMs: now + DAY }],
      now,
    );
    expect(result).toEqual({
      overdue: [],
      soon: [{ title: "Borde", inMs: DAY }],
    });
  });

  it("sorts soon reminders by remaining time ascending", () => {
    const now = 1_000_000;
    const result = computeDeadlineReminders(
      [
        { title: "C", dueMs: now + 5_000 },
        { title: "A", dueMs: now + 1_000 },
        { title: "B", dueMs: now + 3_000 },
      ],
      now,
    );
    expect(result.soon).toEqual([
      { title: "A", inMs: 1_000 },
      { title: "B", inMs: 3_000 },
      { title: "C", inMs: 5_000 },
    ]);
  });

  it("keeps input order for ties in remaining time (stable sort)", () => {
    const now = 1_000_000;
    const result = computeDeadlineReminders(
      [
        { title: "Primero", dueMs: now + 2_000 },
        { title: "Segundo", dueMs: now + 2_000 },
      ],
      now,
    );
    expect(result.soon).toEqual([
      { title: "Primero", inMs: 2_000 },
      { title: "Segundo", inMs: 2_000 },
    ]);
  });

  it("honors a custom soonMs window", () => {
    const now = 1_000_000;
    const result = computeDeadlineReminders(
      [
        { title: "Dentro", dueMs: now + HOUR },
        { title: "Fuera", dueMs: now + 3 * HOUR },
      ],
      now,
      { soonMs: 2 * HOUR },
    );
    expect(result).toEqual({
      overdue: [],
      soon: [{ title: "Dentro", inMs: HOUR }],
    });
  });

  it("separates overdue and soon in a mixed batch", () => {
    const now = 1_000_000;
    const result = computeDeadlineReminders(
      [
        { title: "Vencida", dueMs: now - 10 },
        { title: "Proxima", dueMs: now + HOUR },
        { title: "Distante", dueMs: now + 10 * DAY },
      ],
      now,
    );
    expect(result).toEqual({
      overdue: ["Vencida"],
      soon: [{ title: "Proxima", inMs: HOUR }],
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const now = 1_000_000;
    const tasks = [
      { title: "Uno", dueMs: now + 4_000 },
      { title: "Dos", dueMs: now - 1 },
      { title: "Tres", dueMs: now + 1_000 },
    ];
    const first = computeDeadlineReminders(tasks, now);
    const second = computeDeadlineReminders(tasks, now);
    expect(first).toEqual(second);
  });
});
