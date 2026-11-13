import {
  familyStatus,
  type FamilyStatusKind,
} from "./family-status.ts";
import { familyMembers } from "./thread-management.ts";
import type { ProjectThreadGroup, ThreadFamily } from "./inbox.ts";

export const STATUS_GROUP_ORDER = [
  "needs-you",
  "failed",
  "working",
  "unread",
] as const satisfies readonly FamilyStatusKind[];

export interface ThreadSection {
  kind: string;
  label: string;
  families: ThreadFamily[];
}

const STATUS_LABELS = {
  "needs-you": "Needs your input",
  failed: "Failed",
  working: "Working",
  unread: "Unread",
};

export function familyIsPinned(family: ThreadFamily): boolean {
  return familyMembers(family).some((thread) => thread.isPinned);
}

/**
 * Fork: the "Active" shelf above the project groups. One flat list of families
 * whose current status is live (needs you / working / failed / unread) across
 * every project, ordered by status then by the project order the user already
 * set. Everything else stays where the project groups put it.
 */
export const ACTIVE_SECTION_KINDS = [
  "needs-you",
  "working",
  "failed",
  "unread",
] as const satisfies readonly FamilyStatusKind[];

export function isActiveSectionKind(
  kind: FamilyStatusKind,
): kind is (typeof ACTIVE_SECTION_KINDS)[number] {
  return (ACTIVE_SECTION_KINDS as readonly FamilyStatusKind[]).includes(kind);
}

export function activeFamilies(
  projectGroups: readonly ProjectThreadGroup[],
  now: number,
): ThreadFamily[] {
  const families = projectGroups.flatMap((group) => group.families);
  const rank = new Map<string, number>(
    ACTIVE_SECTION_KINDS.map((kind, index) => [kind, index]),
  );
  const projectRank = new Map<string, number>(
    projectGroups.map((group, index) => [group.project.id, index]),
  );
  const statusOf = (family: ThreadFamily): FamilyStatusKind =>
    familyStatus(familyMembers(family), now).kind;

  return families
    .filter((family) => isActiveSectionKind(statusOf(family)))
    .sort((left, right) => {
      const statusOrder =
        (rank.get(statusOf(left)) ?? 0) - (rank.get(statusOf(right)) ?? 0);
      if (statusOrder !== 0) return statusOrder;
      const projectOrder =
        (projectRank.get(left.root.projectId) ?? 0) -
        (projectRank.get(right.root.projectId) ?? 0);
      if (projectOrder !== 0) return projectOrder;
      return (
        right.root.createdAt - left.root.createdAt ||
        left.root.id.localeCompare(right.root.id)
      );
    });
}

export interface ProjectGroupsWithActiveShelf {
  /** Families lifted into the Active shelf, keyed by root id. */
  liftedRootIds: ReadonlySet<string>;
  /** Project groups with the lifted families removed; empty groups dropped. */
  groups: ProjectThreadGroup[];
}

/**
 * Split the lifted families out of the project groups so a thread shows up
 * exactly once: in the Active shelf, not again under its project.
 */
export function splitActiveFamilies(
  projectGroups: readonly ProjectThreadGroup[],
  now: number,
  liftActive: boolean,
): ProjectGroupsWithActiveShelf {
  if (!liftActive) {
    return { liftedRootIds: new Set(), groups: [...projectGroups] };
  }
  const lifted = new Set(
    activeFamilies(projectGroups, now).map((family) => family.root.id),
  );
  if (lifted.size === 0) {
    return { liftedRootIds: lifted, groups: [...projectGroups] };
  }
  return {
    liftedRootIds: lifted,
    groups: projectGroups.flatMap((group) => {
      const families = group.families.filter(
        (family) => !lifted.has(family.root.id),
      );
      return families.length > 0 ? [{ ...group, families }] : [];
    }),
  };
}

export function groupFamiliesByStatus(
  families: readonly ThreadFamily[],
  now: number,
): ThreadSection[] {
  const grouped = new Map<FamilyStatusKind, ThreadFamily[]>();
  const pinned: ThreadFamily[] = [];
  for (const family of families) {
    if (familyIsPinned(family)) {
      pinned.push(family);
      continue;
    }
    const kind = familyStatus(familyMembers(family), now).kind;
    const entries = grouped.get(kind) ?? [];
    entries.push(family);
    grouped.set(kind, entries);
  }

  const active = STATUS_GROUP_ORDER.flatMap((kind) => {
    const entries = grouped.get(kind);
    return entries?.length
      ? [{ kind, label: STATUS_LABELS[kind], families: entries }]
      : [];
  });
  const idle = [
    ...(grouped.get("inactive") ?? []),
    ...(grouped.get("stale") ?? []),
  ];
  return [
    ...(pinned.length
      ? [{
          kind: "pinned" as const,
          label: "Pinned",
          families: pinned,
        }]
      : []),
    ...active,
    ...(idle.length
      ? [{
          kind: "idle" as const,
          label: "Idle",
          families: idle,
        }]
      : []),
  ];
}
