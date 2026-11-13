// Which project groups the user collapsed. Browser-local, like the project and
// family order this sidebar already keeps: collapsing is a reading preference
// for this screen, not state worth syncing across machines.
//
// Stored as the list of *collapsed* ids, so a project the plugin has never seen
// (or a newly created one) opens expanded by default.
export const COLLAPSED_PROJECTS_STORAGE_KEY = "bb.dockside.collapsed-projects.v1";
export const MAX_COLLAPSED_PROJECTS = 200;
const MAX_ID_LENGTH = 200;
const MAX_RAW_LENGTH = 64_000;
const SAFE_ID = /^[^\u0000-\u001F\u007F]+$/;
const IDS_ONLY = /^[\w.:@/-]+$/;

export interface CollapsedProjectsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): CollapsedProjectsStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function validIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_COLLAPSED_PROJECTS &&
    value.every(
      (id) =>
        typeof id === "string" &&
        id.length > 0 &&
        id.length <= MAX_ID_LENGTH &&
        SAFE_ID.test(id) &&
        IDS_ONLY.test(id),
    )
  );
}

export function decodeCollapsedProjects(raw: string | null): string[] {
  if (raw === null || raw.length > MAX_RAW_LENGTH) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!validIds(parsed)) return [];
    return [...new Set(parsed)];
  } catch {
    return [];
  }
}

export function readCollapsedProjects(
  storage: CollapsedProjectsStorage | null = browserStorage(),
): string[] {
  if (storage === null) return [];
  try {
    return decodeCollapsedProjects(storage.getItem(COLLAPSED_PROJECTS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeCollapsedProjects(
  projectIds: readonly string[],
  storage: CollapsedProjectsStorage | null = browserStorage(),
): boolean {
  if (storage === null) return false;
  const unique = [...new Set(projectIds)];
  if (!validIds(unique)) return false;
  try {
    storage.setItem(COLLAPSED_PROJECTS_STORAGE_KEY, JSON.stringify(unique));
    return true;
  } catch {
    return false;
  }
}

/** Flip one project between collapsed and expanded. */
export function toggleCollapsedProject(
  projectIds: readonly string[],
  projectId: string,
): string[] {
  return projectIds.includes(projectId)
    ? projectIds.filter((id) => id !== projectId)
    : [...projectIds, projectId];
}
