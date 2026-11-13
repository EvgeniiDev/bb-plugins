import { useId, useState } from "react";
import { ThreadCard } from "@/components/inbox/thread-card";
import { Icon } from "@/components/ui/icon";
import type { ProviderGlyphInfo } from "@/components/inbox/provider-glyph";
import type { LifecycleApi } from "@/hooks/use-lifecycle";
import type { DocksidePreferences } from "@/lib/preferences";
import type { ThreadFamily } from "@/lib/inbox";
import { cn } from "@/lib/utils";
import {
  BULK_PROTECTION_LABELS,
  bulkEligibility,
  type RootSelectionIntent,
} from "@/lib/thread-management";

/**
 * Fork: one shelf at the top of projects mode with every family that currently
 * needs a human — Needs you, Working, Failed, Unread — from all projects.
 * Rows carry their project badge, because the shelf is flat.
 */
export function ActiveSection({
  families,
  providerInfoById,
  activeThreadId,
  forceExpanded,
  lifecycle,
  onNavigate,
  now,
  selectionMode,
  selectedRootIds,
  selectionHintId,
  onToggleRoot,
  preferences,
  projectNames,
  projectColorOverrides,
}: {
  families: readonly ThreadFamily[];
  projectNames: ReadonlyMap<string, string>;
  projectColorOverrides: ReadonlyMap<string, string>;
  providerInfoById: ReadonlyMap<string, ProviderGlyphInfo>;
  activeThreadId: string | null;
  forceExpanded: boolean;
  lifecycle: LifecycleApi;
  onNavigate: () => void;
  now: number;
  selectionMode: boolean;
  selectedRootIds: ReadonlySet<string>;
  selectionHintId: string;
  onToggleRoot: (threadId: string, intent: RootSelectionIntent) => void;
  preferences: DocksidePreferences;
}) {
  const [expanded, setExpanded] = useState(true);
  const listId = useId();
  const effectiveExpanded = forceExpanded || expanded;
  if (families.length === 0) return null;

  return (
    <section
      aria-label="Active threads"
      data-dockside-active-section=""
      className="mb-1.5 border-b border-sidebar-border/70 pb-1.5"
    >
      <button
        type="button"
        aria-expanded={effectiveExpanded}
        aria-controls={listId}
        onClick={() => setExpanded((open) => !open)}
        className="flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Icon name="Zap" className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wider text-foreground/90">
          Active
        </span>
        <span className="shrink-0 tabular-nums text-2xs text-muted-foreground/70">
          {families.length}
        </span>
        <Icon
          name="ChevronDown"
          className={cn(
            "size-3 shrink-0 text-muted-foreground/70 transition-transform",
            effectiveExpanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {effectiveExpanded ? (
        <ul id={listId} className="mt-0.5 flex flex-col gap-0.5">
          {families.map((family) => {
            const eligibility = bulkEligibility(family, activeThreadId);
            return (
              <ThreadCard
                key={family.root.id}
                thread={family.root}
                childThreads={family.children}
                providerInfoById={providerInfoById}
                activeThreadId={activeThreadId}
                canPark={lifecycle.canPark(family.root)}
                forceExpanded={forceExpanded}
                onNavigate={onNavigate}
                onSettle={() => lifecycle.settle(family.root.id)}
                onSnooze={(until) => lifecycle.snooze(family.root.id, until)}
                now={now}
                selectionMode={selectionMode}
                selected={selectedRootIds.has(family.root.id)}
                selectionDisabledReason={
                  eligibility.eligible
                    ? null
                    : BULK_PROTECTION_LABELS[eligibility.reason]
                }
                selectionHintId={selectionHintId}
                onToggleSelected={(intent) =>
                  onToggleRoot(family.root.id, intent)
                }
                reorderEnabled={false}
                reorderDisabledReason="Switch to All to reorder thread families."
                onMoveByKeyboard={() => {}}
                onReorderDragStart={(event) => event.preventDefault()}
                onReorderDragOver={() => {}}
                onReorderDrop={(event) => event.preventDefault()}
                preferences={preferences}
                groupedByStatus
                projectName={projectNames.get(family.root.projectId)}
                projectColorOverride={projectColorOverrides.get(
                  family.root.projectId,
                )}
              />
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
