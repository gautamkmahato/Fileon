"use client";

import { useAuth } from "../_components/auth/AuthProvider";
import { SignInScreen } from "../_components/auth/SignInScreen";
import { AppShell } from "../_components/layout/AppShell";
import { TagsProvider } from "../_components/tags/TagsProvider";
import { PinsProvider } from "../_components/pins/PinsProvider";
import { HiddenProvider } from "../_components/hidden/HiddenProvider";
import { InboxProvider } from "../_components/inbox/InboxProvider";
import { FavoritesProvider } from "../_components/favorites/FavoritesProvider";
import { FolderCoversProvider } from "../_components/folder-covers/FolderCoversProvider";
import { ViewsProvider } from "../_components/views/ViewsProvider";
import { SpacesProvider } from "../_components/spaces/SpacesProvider";
import { ShareLinksProvider } from "../_components/shares/ShareLinksProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <SignInScreen />;
  return (
    <TagsProvider>
      <ViewsProvider>
        <SpacesProvider>
        <ShareLinksProvider>
        <PinsProvider>
          <FavoritesProvider>
          <HiddenProvider>
            <InboxProvider>
            <FolderCoversProvider>
              <AppShell>{children}</AppShell>
            </FolderCoversProvider>
            </InboxProvider>
          </HiddenProvider>
          </FavoritesProvider>
        </PinsProvider>
        </ShareLinksProvider>
        </SpacesProvider>
      </ViewsProvider>
    </TagsProvider>
  );
}
