// Which plugin draws the sidebar thread list is a server-synced UI preference:
// `sidebar.threadListProvider`, stored as a plugin key ("<pluginId>/<slotId>").
// bb's own Settings → Appearance → Sidebar writes it through
// PUT /api/v1/preferences/ui/<key> with optimistic concurrency (revision), so
// this module does the same instead of touching any private localStorage key.
//
// `__automatic__` is bb's default: the first installed thread-list plugin other
// than the bundled one wins, which here is Dockside.

export const THREAD_LIST_PROVIDER_KEY = "sidebar.threadListProvider";
export const DOCKSIDE_THREAD_LIST_PROVIDER = "dockside/inbox";
export const BUILTIN_THREAD_LIST_PROVIDER = "thread-list/thread-list";
const AUTOMATIC_THREAD_LIST_PROVIDER = "__automatic__";

const PREFERENCES_PATH = "/api/v1/preferences/ui";

type PreferenceEntry = { revision: number; value: unknown };

async function readEntry(): Promise<PreferenceEntry | null> {
  const response = await fetch(PREFERENCES_PATH, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`bb answered ${response.status}`);
  const body = (await response.json()) as {
    preferences?: Record<string, PreferenceEntry>;
  };
  return body.preferences?.[THREAD_LIST_PROVIDER_KEY] ?? null;
}

/** The provider bb currently resolves for the sidebar thread list. */
export function threadListProviderFrom(value: unknown): string {
  return typeof value === "string" && value.length > 0
    ? value
    : AUTOMATIC_THREAD_LIST_PROVIDER;
}

export function isDocksideProvider(value: unknown): boolean {
  const provider = threadListProviderFrom(value);
  return (
    provider === DOCKSIDE_THREAD_LIST_PROVIDER ||
    provider === AUTOMATIC_THREAD_LIST_PROVIDER
  );
}

export function readThreadListProvider(): Promise<string | null> {
  return readEntry()
    .then((entry) => (entry === null ? null : threadListProviderFrom(entry.value)))
    .catch(() => null);
}

/**
 * Write the preference, retrying once when another client bumped the revision
 * between the read and the write (409 is bb's conflict answer).
 */
export async function writeThreadListProvider(
  providerId: string,
): Promise<boolean> {
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const entry = await readEntry();
      if (entry === null) return false;
      const response = await fetch(
        `${PREFERENCES_PATH}/${encodeURIComponent(THREAD_LIST_PROVIDER_KEY)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedRevision: entry.revision,
            value: providerId,
          }),
        },
      );
      if (response.ok) return true;
      if (response.status !== 409) return false;
    }
    return false;
  } catch {
    return false;
  }
}

export function selectBuiltinThreadList(): Promise<boolean> {
  return writeThreadListProvider(BUILTIN_THREAD_LIST_PROVIDER);
}

export function selectDocksideThreadList(): Promise<boolean> {
  return writeThreadListProvider(DOCKSIDE_THREAD_LIST_PROVIDER);
}

/** Flip between bb's built-in thread list and Dockside. */
export async function toggleThreadList(): Promise<boolean> {
  const provider = await readThreadListProvider();
  const docksideActive = isDocksideProvider(provider);
  return docksideActive ? selectBuiltinThreadList() : selectDocksideThreadList();
}
