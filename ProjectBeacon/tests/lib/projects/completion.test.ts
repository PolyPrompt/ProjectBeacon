import { describe, expect, it } from "vitest";
import { isProjectComplete } from "@/lib/projects/completion";

describe("isProjectComplete", () => {
  it("returns false when there are no tasks", () => {
    expect(isProjectComplete([])).toBe(false);
  });

  it("returns true when every task is done", () => {
    expect(isProjectComplete(["done", "done"])).toBe(true);
  });

  it("returns false when any task is not done", () => {
    expect(isProjectComplete(["done", "in_progress", "done"])).toBe(false);
  });
});
