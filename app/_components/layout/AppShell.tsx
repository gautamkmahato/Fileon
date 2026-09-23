"use client";

import { Bell, Box, ChevronDown, LogOut, Search } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeProvider";
import { DriveBrowseProvider, useDriveBrowse } from "../drive/context/DriveBrowseProvider";
import { DriveModals } from "../drive/shell/DriveModals";
import { DriveOverlays } from "../drive/shell/DriveOverlays";
import { FileListView } from "../drive/views/FileListView";
import { ActivityPageView } from "../drive/views/ActivityPageView";
import { ControlsPageView } from "../drive/views/ControlsPageView";
import { InboxPageView } from "../inbox/InboxPageView";
import { CleanupPageView } from "../cleanup/CleanupPageView";
import { SmartSpacesHome } from "../spaces/SmartSpacesHome";
import { ShareLinksHome } from "../shares/ShareLinksHome";
import { APP_NAME } from "@/lib/brand";

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function AppShellInner() {
  const { token } = useAuth();
  const {
    profile, signOut, quota, sidebarCollapsed, setSidebarCollapsed,
    dragDrop, setTagManageOpen, isActivityView, isControlsView, isInboxView, isCleanupView, isSpacesHome, isSharedLinksView, setGlobalSearchOpen,
  } = useDriveBrowse();

  const displayName = profile?.given_name || profile?.name || "Account";

  return (
    <div
      className="h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex flex-col transition-colors"
      onDragEnter={dragDrop.onWindowDragEnter}
      onDragLeave={dragDrop.onWindowDragLeave}
      onDragOver={dragDrop.onWindowDragOver}
      onDrop={dragDrop.onWindowDrop}
    >
      <header className="shrink-0 z-40 h-14 bg-white/90 dark:bg-zinc-900 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 transition-colors">
        <div className="h-full px-4 sm:px-6 flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center">
              <Box className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hidden sm:inline">
              {APP_NAME}
            </span>
          </div>

          <div className="flex-1 max-w-lg mx-auto min-w-0">
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="w-full h-9 px-3.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70 text-zinc-500 dark:text-zinc-400 text-sm flex items-center gap-2.5 transition-colors"
            >
              <Search className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1 text-left truncate">Search files, folders, people…</span>
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" strokeWidth={1.75} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500" />
            </button>
            <ThemeToggle />
            {profile && (
              <button
                type="button"
                className="hidden sm:flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {profile.picture ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profile.picture} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-700 flex items-center justify-center text-[11px] font-bold text-white">
                    {profileInitials(displayName)}
                  </div>
                )}
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 max-w-[96px] truncate">
                  {displayName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={2} />
              </button>
            )}
            <button
              onClick={signOut}
              className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          quota={quota}
          token={token}
          onFolderDrop={dragDrop.onFolderDrop}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onManageTags={() => setTagManageOpen(true)}
        />

        <main className={`flex-1 min-h-0 min-w-0 ${
          isInboxView ? "p-3 overflow-hidden flex flex-col" : "px-6 py-6 overflow-auto"
        }`}>
          {isActivityView ? (
            <ActivityPageView />
          ) : isControlsView ? (
            <ControlsPageView />
          ) : isInboxView ? (
            <InboxPageView />
          ) : isCleanupView ? (
            <CleanupPageView />
          ) : isSpacesHome ? (
            <SmartSpacesHome />
          ) : isSharedLinksView ? (
            <ShareLinksHome />
          ) : (
            <FileListView />
          )}
        </main>
      </div>

      <DriveOverlays />
      <DriveModals />
    </div>
  );
}

/** App shell: top navbar, sidebar, main content. Views stay mounted across route changes. */
export function AppShell({ children: _children }: { children: React.ReactNode }) {
  void _children;
  return (
    <DriveBrowseProvider>
      <AppShellInner />
    </DriveBrowseProvider>
  );
}
