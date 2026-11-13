import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PluginSidebarProject, PluginSidebarThread } from "@get-bb/plugin-sdk";
import { groupThreadsByProject } from "../lib/inbox.ts";
import { DAY_MS } from "../lib/thread-management.ts";
import {
  ACTIVE_SECTION_KINDS,
  activeFamilies,
  splitActiveFamilies,
} from "../lib/status-groups.ts";
import { groupSidebarFamilies } from "../lib/sidebar-sections.ts";

function thread(overrides: Partial<PluginSidebarThread>): PluginSidebarThread {
  return {
    id: "thread",
    projectId: "alpha",
    title: "Thread",
    titleFallback: null,
    parentThreadId: null,
    sectionId: null,
    originKind: null,
    originPluginId: null,
    providerId: "codex",
    hasPendingInteraction: false,
    activity: { workflows: 0, backgroundAgents: 0, backgroundCommands: 0, planMode: 0, goals: 0 },
    indicator: "none",
    indicatorLabel: null,
    isUnread: false,
    isPinned: false,
    isArchived: false,
    environment: null,
    host: null,
    createdAt: 1,
    updatedAt: 1,
    lastReadAt: 1,
    latestAttentionAt: 1,
    ...overrides,
  };
}

const projects: PluginSidebarProject[] = [
  { id: "alpha", name: "Alpha", isPersonal: false },
  { id: "beta", name: "Beta", isPersonal: false },
];

const now = 10 * DAY_MS;

describe("active shelf", () => {
  it("lifts only live statuses, ordered by status then project order", () => {
    const groups = groupThreadsByProject(
      [
        thread({ id: "alpha-idle", projectId: "alpha", updatedAt: now, createdAt: 5 }),
        thread({ id: "beta-working", projectId: "beta", indicator: "runtime", updatedAt: now, createdAt: 4 }),
        thread({ id: "alpha-needs", projectId: "alpha", hasPendingInteraction: true, updatedAt: now, createdAt: 3 }),
        thread({ id: "beta-unread", projectId: "beta", isUnread: true, updatedAt: now, createdAt: 2 }),
        thread({ id: "alpha-failed", projectId: "alpha", indicator: "unread-error", updatedAt: now, createdAt: 1 }),
      ],
      projects,
    );

    const lifted = activeFamilies(groups, now).map((family) => family.root.id);
    assert.deepEqual(lifted, ["alpha-needs", "beta-working", "alpha-failed", "beta-unread"]);
    assert.deepEqual([...ACTIVE_SECTION_KINDS], ["needs-you", "working", "failed", "unread"]);
  });

  it("takes lifted families out of their project and drops empty groups", () => {
    const groups = groupThreadsByProject(
      [
        thread({ id: "alpha-working", projectId: "alpha", indicator: "runtime", updatedAt: now }),
        thread({ id: "beta-idle", projectId: "beta", updatedAt: now }),
      ],
      projects,
    );

    const split = splitActiveFamilies(groups, now, true);
    assert.deepEqual([...split.liftedRootIds], ["alpha-working"]);
    assert.deepEqual(
      split.groups.map((group) => [group.project.id, group.families.map((family) => family.root.id)]),
      [["beta", ["beta-idle"]]],
    );

    const off = splitActiveFamilies(groups, now, false);
    assert.equal(off.liftedRootIds.size, 0);
    assert.deepEqual(off.groups.map((group) => group.project.id), ["alpha", "beta"]);
  });

  it("keeps dumped children attached to a lifted root", () => {
    const groups = groupThreadsByProject(
      [
        thread({ id: "root", projectId: "alpha", indicator: "runtime", updatedAt: now }),
        thread({ id: "child", projectId: "alpha", parentThreadId: "root", isUnread: true }),
        thread({ id: "other", projectId: "alpha", updatedAt: now }),
      ],
      projects,
    );
    const lifted = activeFamilies(groups, now);
    assert.equal(lifted.length, 1);
    assert.deepEqual(lifted[0]!.children.map((child) => child.id), ["child"]);
  });

  it("environment grouping shows live statuses and then environments, once each", () => {
    const families = groupThreadsByProject(
      [
        thread({ id: "needs", projectId: "alpha", hasPendingInteraction: true, updatedAt: now }),
        thread({ id: "idle", projectId: "beta", updatedAt: now }),
      ],
      projects,
    ).flatMap((group) => group.families);

    const sections = groupSidebarFamilies(families, now);
    assert.deepEqual(sections.map((section) => section.kind), [
      "needs-you",
      JSON.stringify(["beta", null, null]),
    ]);
    assert.deepEqual(
      sections.flatMap((section) => section.families.map((family) => family.root.id)),
      ["needs", "idle"],
    );
  });
});
