import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { selectBuiltinThreadList } from "@/lib/thread-list-provider";

/**
 * One-click way out of Dockside, sitting in Dockside's own header. The return
 * trip is the footer action registered in app.tsx, which bb renders whether or
 * not this list is the active one.
 *
 * The preference is server-synced, so bb re-renders the sidebar on its own —
 * no reload needed; `busy` only covers the round trip.
 */
export function ThreadListSwitch() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      title="Switch to bb's built-in thread list"
      aria-label="Switch to bb's built-in thread list"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void selectBuiltinThreadList()
          .then((ok) => {
            if (!ok) {
              console.warn("Dockside could not store the thread list preference.");
            }
          })
          .finally(() => setBusy(false));
      }}
      className="flex h-6 items-center gap-1 rounded-md px-1.5 text-2xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
    >
      <Icon
        name={busy ? "Loading" : "Columns2"}
        className={busy ? "size-3.5 animate-spin" : "size-3.5"}
        aria-hidden
      />
      <span>Built-in</span>
    </button>
  );
}
