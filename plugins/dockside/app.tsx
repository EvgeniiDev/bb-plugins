// bb-plugin-dockside — a project-first replacement for bb's sidebar thread
// list. Root threads keep a stable position and expand their child agents in
// place, so activity changes state without moving the user's navigation.
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { ThreadInbox } from "@/components/inbox/thread-inbox";
import { ParentChip } from "@/components/inbox/parent-chip";
import { DocksideSettingsSection } from "@/components/settings/dockside-settings";
import { MobileNavigation } from "@/components/mobile/navigation";
import { toggleThreadList } from "@/lib/thread-list-provider";

export default definePluginApp((app) => {
  app.composer.customize({
    id: "mobile-navigation",
    scopes: ["thread"],
    banners: [{ id: "navigation", chrome: "bare", component: MobileNavigation }],
  });
  app.slots.settingsSection({
    id: "appearance",
    title: "Appearance & behavior",
    description: "Preview the effective Dockside palette and layout settings.",
    component: DocksideSettingsSection,
  });

  // bb renders this footer button no matter which thread list is active, so it
  // is the way back from bb's built-in list to Dockside.
  app.slots.sidebarFooterAction({
    id: "thread-list-switch",
    title: "Switch between Dockside and bb's built-in thread list",
    icon: "Columns2",
    run: async () => {
      const ok = await toggleThreadList();
      if (!ok) console.warn("Dockside could not store the thread list preference.");
    },
  });

  app.slots.experimental_threadList({
    id: "inbox",
    title: "Dockside (projects)",
    description:
      "Stable project groups with expandable root threads and inline agents.",
    component: ThreadInbox,
  });

  // A child remains nested in the sidebar, and this is the direct route back
  // to its root while the user is focused in the thread itself.
  app.slots.experimental_threadHeaderAction({
    id: "parent",
    title: "Parent thread",
    component: ParentChip,
  });
});
