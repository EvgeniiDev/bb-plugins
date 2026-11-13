import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COLLAPSED_PROJECTS_STORAGE_KEY,
  MAX_COLLAPSED_PROJECTS,
  decodeCollapsedProjects,
  readCollapsedProjects,
  toggleCollapsedProject,
  writeCollapsedProjects,
} from "../lib/collapsed-projects.ts";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    raw: map,
  };
}

describe("collapsed project groups", () => {
  it("decodes only valid id lists and otherwise opens everything", () => {
    assert.deepEqual(decodeCollapsedProjects(null), []);
    assert.deepEqual(decodeCollapsedProjects("{not json"), []);
    assert.deepEqual(decodeCollapsedProjects(JSON.stringify({ a: 1 })), []);
    assert.deepEqual(decodeCollapsedProjects(JSON.stringify(["proj_1", 2])), []);
    assert.deepEqual(decodeCollapsedProjects(JSON.stringify(["a\u0000b"])), []);
    assert.deepEqual(decodeCollapsedProjects(JSON.stringify(["proj_1", "proj_1"])), ["proj_1"]);
    const tooMany = Array.from({ length: MAX_COLLAPSED_PROJECTS + 1 }, (_, i) => `p${i}`);
    assert.deepEqual(decodeCollapsedProjects(JSON.stringify(tooMany)), []);
  });

  it("round-trips through storage and survives a refused write", () => {
    const storage = fakeStorage();
    assert.deepEqual(readCollapsedProjects(storage), []);
    assert.equal(writeCollapsedProjects(["proj_a", "proj_b"], storage), true);
    assert.deepEqual(readCollapsedProjects(storage), ["proj_a", "proj_b"]);
    assert.equal(storage.getItem(COLLAPSED_PROJECTS_STORAGE_KEY), '["proj_a","proj_b"]');

    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    assert.deepEqual(readCollapsedProjects(broken), []);
    assert.equal(writeCollapsedProjects(["proj_a"], broken), false);
  });

  it("toggles one project and keeps the rest", () => {
    assert.deepEqual(toggleCollapsedProject([], "proj_a"), ["proj_a"]);
    assert.deepEqual(toggleCollapsedProject(["proj_a", "proj_b"], "proj_a"), ["proj_b"]);
    assert.deepEqual(toggleCollapsedProject(["proj_a"], "proj_b"), ["proj_a", "proj_b"]);
  });
});
