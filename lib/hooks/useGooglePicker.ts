"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import type { PickedDoc } from "@/lib/types/google-types";

/**
 * Loads the Google Picker API and exposes a function to open a picker.
 *
 * Why we need this: with `drive.file` scope, the app can only see files it
 * created. The Picker lets the user explicitly grant access to existing files,
 * which then become visible to the app (no verification needed).
 */
export function useGooglePicker(opts: { token: string | null; apiKey: string | undefined }) {
  const { token, apiKey } = opts;
  const [isLoaded, setIsLoaded] = useState(false);
  const callbackRef = useRef<((docs: PickedDoc[]) => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.google?.picker) {
      setIsLoaded(true);
      return;
    }
    // Picker requires both gapi (for the loader) and the picker module.
    const gapiScript = document.getElementById("gapi-script") as HTMLScriptElement | null;
    if (gapiScript) {
      gapiScript.addEventListener("load", initPicker, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.id = "gapi-script";
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.defer = true;
    s.onload = initPicker;
    document.head.appendChild(s);

    function initPicker() {
      if (!window.gapi) return;
      window.gapi.load("picker", () => setIsLoaded(true));
    }
  }, []);

  const open = useCallback(
    (config: {
      onPicked: (docs: PickedDoc[]) => void;
      multiselect?: boolean;
      mimeTypes?: string; // comma-separated; e.g. "application/pdf,image/png"
      foldersOnly?: boolean;
      title?: string;
    }) => {
      if (!isLoaded || !window.google?.picker || !token || !apiKey) {
        console.warn("[picker] not ready", { isLoaded, hasToken: !!token, hasApiKey: !!apiKey });
        return;
      }
      callbackRef.current = config.onPicked;
      const picker = window.google.picker;

      const view = new picker.DocsView(picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(config.foldersOnly ?? false);
      if (config.mimeTypes) view.setMimeTypes(config.mimeTypes);

      const builder = new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setTitle(config.title ?? `Open with ${APP_NAME}`)
        .setCallback((data) => {
          if (data.action === picker.Action.PICKED && data.docs) {
            callbackRef.current?.(data.docs);
          }
        });
      if (config.multiselect) builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);

      builder.build().setVisible(true);
    },
    [isLoaded, token, apiKey]
  );

  return { isLoaded, open };
}
