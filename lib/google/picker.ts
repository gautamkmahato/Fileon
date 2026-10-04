import type { PickedDoc, PickerInstance } from "@/lib/types/google-types";

/**
 * Google Picker wrapper.
 *
 * With the `drive.file` scope the app only sees files it created or files the
 * user picked here. Picking a file grants the app lasting access to it for this
 * Google account, so the Picker is the only onboarding step.
 */

const GAPI_SCRIPT_ID = "gapi-script";
const GAPI_SRC = "https://apis.google.com/js/api.js";

let loadPromise: Promise<void> | null = null;

/** Load the Picker module once. Resolves when `window.google.picker` exists. */
export function loadGooglePicker(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Picker needs a browser"));
  if (window.google?.picker) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const init = () => {
      if (!window.gapi) {
        reject(new Error("Google API loader did not initialise"));
        return;
      }
      window.gapi.load("picker", () => resolve());
    };

    const existing = document.getElementById(GAPI_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.gapi) init();
      else existing.addEventListener("load", init, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GAPI_SCRIPT_ID;
    script.src = GAPI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = init;
    script.onerror = () => reject(new Error("Could not load the Google Picker script"));
    document.head.appendChild(script);
  }).catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

type PickerResult =
  | { action: "picked"; docs: PickedDoc[] }
  | { action: "cancel" };

export interface OpenPickerOptions {
  token: string;
  apiKey: string;
  /** Google Cloud project number. Required for `drive.file` grants. */
  appId: string;
  /** Open the Picker inside this folder instead of My Drive. */
  parentId?: string | null;
  title: string;
  /** Hide the left navigation so the user stays in the opened folder. */
  hideNav?: boolean;
}

export interface PickerHandle {
  result: Promise<PickerResult>;
  /** Close the Picker without a result (used when the user presses Stop). */
  dispose: () => void;
}

/** Open a multiselect Picker that shows folders and files together. */
export function openDrivePicker(opts: OpenPickerOptions): PickerHandle {
  let instance: PickerInstance | null = null;
  let settled = false;
  let resolveResult: (result: PickerResult) => void = () => {};

  const result = new Promise<PickerResult>((resolve, reject) => {
    resolveResult = (r) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const picker = window.google?.picker;
    if (!picker) {
      reject(new Error("Google Picker is not loaded"));
      return;
    }

    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMode(picker.DocsViewMode.LIST);
    if (opts.parentId) view.setParent(opts.parentId);

    const builder = new picker.PickerBuilder()
      .addView(view)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(opts.token)
      .setDeveloperKey(opts.apiKey)
      .setAppId(opts.appId)
      .setTitle(opts.title)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) {
          resolveResult({ action: "picked", docs: data.docs ?? [] });
        } else if (data.action === picker.Action.CANCEL) {
          resolveResult({ action: "cancel" });
        }
      });
    if (opts.hideNav) builder.enableFeature(picker.Feature.NAV_HIDDEN);

    instance = builder.build();
    instance.setVisible(true);
  });

  return {
    result,
    dispose: () => {
      try {
        instance?.setVisible(false);
        instance?.dispose();
      } catch {
        // Picker already closed.
      }
      resolveResult({ action: "cancel" });
    },
  };
}
