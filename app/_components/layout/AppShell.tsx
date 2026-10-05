"use client";

import { useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, Search, User } from "lucide-react";
import Link from "next/link";
import { driveRoutes } from "@/lib/navigation/routes";
import { AnchorDropdownMenu } from "../drive/browse/AnchorDropdownMenu";
import { AppLogo } from "../brand/AppLogo";
import { useAuth } from "../auth/AuthProvider";
import { Sidebar } from "./sidebar/Sidebar";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className="h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex flex-col transition-colors"
      onDragEnter={dragDrop.onWindowDragEnter}
      onDragLeave={dragDrop.onWindowDragLeave}
      onDragOver={dragDrop.onWindowDragOver}
      onDrop={dragDrop.onWindowDrop}
    >
      <header className="shrink-0 z-40 h-14 bg-white/90 dark:bg-zinc-900 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 transition-colors">
        <div className="h-full px-2 sm:px-4 flex items-center gap-2 sm:gap-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <AppLogo
            href="/dashboard"
            size="xs"
            showName
            className="shrink-0"
            nameClassName="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hidden sm:inline"
          />

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
              <>
                <button
                  ref={profileMenuRef}
                  type="button"
                  onClick={() => setProfileMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 sm:gap-2 h-9 pl-1 pr-1.5 sm:pr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                >
                  {profile.picture ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={profile.picture} alt="" className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-amber-700 flex items-center justify-center text-[11px] font-bold text-white">
                      {profileInitials(displayName)}
                    </div>
                  )}
                  <span className="hidden sm:inline text-sm font-medium text-zinc-900 dark:text-zinc-100 max-w-[96px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                    strokeWidth={2}
                  />
                </button>
                <AnchorDropdownMenu
                  open={profileMenuOpen}
                  onClose={() => setProfileMenuOpen(false)}
                  anchorRef={profileMenuRef}
                  minWidth={200}
                >
                  <Link
                    href={driveRoutes.controls}
                    onClick={() => setProfileMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left"
                  >
                    <User className="w-4 h-4 text-zinc-500 shrink-0" strokeWidth={1.75} />
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <LogOut className="w-4 h-4 text-zinc-500 shrink-0" strokeWidth={1.75} />
                    Sign out
                  </button>
                </AnchorDropdownMenu>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden relative">
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <Sidebar
          collapsed={sidebarCollapsed}
          quota={quota}
          token={token}
          onFolderDrop={dragDrop.onFolderDrop}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onManageTags={() => setTagManageOpen(true)}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        <main className={`flex-1 min-h-0 min-w-0 ${
          isInboxView
            ? "p-2 sm:p-3 overflow-hidden flex flex-col"
            : "px-3 py-4 lg:px-6 lg:py-6 overflow-auto"
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
