/**
 * Minimal type declarations for the Google Identity Services and Google Picker
 * scripts loaded at runtime. Full types are large; only what the app uses is
 * declared here.
 */

declare global {
  interface Window {
    google?: GoogleNamespace;
    gapi?: GapiNamespace;
  }
}

export interface GoogleNamespace {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        prompt?: string;
        /** Defaults to true, which would re-attach older, broader grants. */
        include_granted_scopes?: boolean;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: TokenError) => void;
      }) => TokenClient;
      revoke: (token: string, callback?: () => void) => void;
    };
  };
  picker?: PickerNamespace;
}

export interface GapiNamespace {
  load: (api: string, callback: () => void) => void;
}

export interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface TokenError {
  type: string;
  message?: string;
}

interface PickerNamespace {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new (viewId?: string) => PickerDocsView;
  ViewId: { DOCS: string; FOLDERS: string; [key: string]: string };
  DocsViewMode: { LIST: string; GRID: string };
  Feature: {
    MULTISELECT_ENABLED: string;
    NAV_HIDDEN: string;
    SUPPORT_DRIVES: string;
  };
  Action: { PICKED: string; CANCEL: string; LOADED: string };
}

interface PickerDocsView {
  setIncludeFolders: (include: boolean) => PickerDocsView;
  setSelectFolderEnabled: (enabled: boolean) => PickerDocsView;
  setMimeTypes: (types: string) => PickerDocsView;
  setMode: (mode: string) => PickerDocsView;
  setParent: (parentId: string) => PickerDocsView;
  /** Flat list limited to these ids. Do not combine with setEnableDrives or setParent. */
  setFileIds: (fileIds: string) => PickerDocsView;
  setEnableDrives: (enabled: boolean) => PickerDocsView;
}

interface PickerBuilder {
  addView: (view: string | PickerDocsView) => PickerBuilder;
  enableFeature: (feature: string) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (appId: string) => PickerBuilder;
  setCallback: (callback: (data: PickerCallbackData) => void) => PickerBuilder;
  setTitle: (title: string) => PickerBuilder;
  build: () => PickerInstance;
}

export interface PickerInstance {
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

interface PickerCallbackData {
  action: string;
  docs?: PickedDoc[];
}

export interface PickedDoc {
  id: string;
  name: string;
  mimeType: string;
  parentId?: string;
  url?: string;
  sizeBytes?: number;
  iconUrl?: string;
}

export {};
