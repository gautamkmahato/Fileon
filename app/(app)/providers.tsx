"use client";

import type { ReactNode } from "react";
import { TagsProvider } from "../_components/tags/TagsProvider";
import { ViewsProvider } from "../_components/views/ViewsProvider";
import { SpacesProvider } from "../_components/spaces/SpacesProvider";
import { ShareLinksProvider } from "../_components/shares/ShareLinksProvider";
import { PinsProvider } from "../_components/pins/PinsProvider";
import { FavoritesProvider } from "../_components/favorites/FavoritesProvider";
import { HiddenProvider } from "../_components/hidden/HiddenProvider";
import { InboxProvider } from "../_components/inbox/InboxProvider";
import { FolderCoversProvider } from "../_components/folder-covers/FolderCoversProvider";

type ProviderComponent = (props: { children: ReactNode }) => ReactNode;

/**
 * Feature providers for the signed-in app, outermost first.
 * Order matters: later providers may read from earlier ones
 * (e.g. route parsing depends on Views and Spaces).
 */
const APP_PROVIDERS: ProviderComponent[] = [
  TagsProvider,
  ViewsProvider,
  SpacesProvider,
  ShareLinksProvider,
  PinsProvider,
  FavoritesProvider,
  HiddenProvider,
  InboxProvider,
  FolderCoversProvider,
];

export function AppProviders({ children }: { children: ReactNode }) {
  return APP_PROVIDERS.reduceRight<ReactNode>(
    (inner, Provider) => <Provider>{inner}</Provider>,
    children,
  );
}
