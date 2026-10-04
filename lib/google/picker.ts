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

export interface PickerViewSpec {
  /** Key of `google.picker.ViewId`, e.g. "FOLDERS" or "DOCS_IMAGES". */
  viewId?: string;
  mimeTypes?: string;
  /** Comma-separated ids. Limits the view to those items. */
  fileIds?: string;
  selectFolders?: boolean;
  /** Shared drives. Ignored when fileIds is set; the Picker forbids combining them. */
  enableDrives?: boolean;
}

export interface OpenPickerOptions {
  token: string;
  apiKey: string;
  /** Google Cloud project number. Required for `drive.file` grants. */
  appId: string;
  title: string;
  view: PickerViewSpec;
  /** Hide the left navigation so the user stays on this flat list. */
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

    const viewId = opts.view.viewId ? picker.ViewId[opts.view.viewId] : undefined;
    const view = new picker.DocsView(viewId).setMode(picker.DocsViewMode.LIST);
    if (opts.view.selectFolders) {
      view.setIncludeFolders(true).setSelectFolderEnabled(true);
    }
    if (opts.view.mimeTypes) view.setMimeTypes(opts.view.mimeTypes);
    if (opts.view.fileIds) view.setFileIds(opts.view.fileIds);
    else if (opts.view.enableDrives && view.setEnableDrives) view.setEnableDrives(true);

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
