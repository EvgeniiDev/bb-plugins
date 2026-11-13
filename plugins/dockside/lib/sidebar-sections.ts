import type { ThreadFamily } from "./inbox.ts";
import {
  activeFamilies,
  familyIsPinned,
  groupFamiliesByStatus,
  type ThreadSection,
} from "./status-groups.ts";

/**
 * Group families into sections labelled by their environment, and — fork —
 * by the live status Dockside gives every family. A family appears once: in
 * its status section when it has a live one (failed, needs you, working,
 * unread), otherwise in its environment section.
 */
export function groupSidebarFamilies(
  families: readonly ThreadFamily[],
  now: number,
): ThreadSection[] {
  const pinned = families.filter(familyIsPinned);
  const liftable = families.filter((family) => !familyIsPinned(family));
  const active = activeFamilies(
    [
      {
        project: { id: "all", name: "All", isPersonal: false },
        families: liftable,
      },
    ],
    now,
  );
  const activeIds = new Set(active.map((family) => family.root.id));
  const statusSections: ThreadSection[] = [
    ...groupFamiliesByStatus(active, now),
  ];
  const remaining = liftable.filter(
    (family) => !activeIds.has(family.root.id),
  );
  const sections: ThreadSection[] = pinned.length
    ? [{ kind: "pinned", label: "Pinned", families: pinned }]
    : [];
  const environments = new Map<string, ThreadSection>();
  for (const family of remaining) {
    const { environment, host, projectId } = family.root;
    // IDs keep same-named worktrees on different machines separate.
    const key = JSON.stringify([projectId, host?.id, environment?.id ?? environment?.name]);
    let section = environments.get(key);
    if (!section) {
      const name = environment?.name || environment?.branchName || "No environment";
      section = {
        kind: key,
        label: host?.name ? `${name} · ${host.name}` : name,
        families: [],
      };
      environments.set(key, section);
    }
    section.families.push(family);
  }
  return [...sections, ...statusSections, ...environments.values()];
}
