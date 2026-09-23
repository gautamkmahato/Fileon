/**
 * Minimal type declarations for the Google Identity Services and Picker
 * scripts we load at runtime. Full types are huge; we only declare what we use.
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
        callback: (response: TokenResponse) => void;
        error_callback?: (error: TokenError) => void;
      }) => TokenClient;
      revoke: (token: string, callback?: () => void) => void;
    };
  };
  picker: PickerNamespace;
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

export interface PickerNamespace {
  PickerBuilder: new () => PickerBuilder;
  ViewId: {
    DOCS: string;
    DOCS_IMAGES: string;
    DOCS_VIDEOS: string;
    FOLDERS: string;
    SPREADSHEETS: string;
    PRESENTATIONS: string;
    PDFS: string;
    [key: string]: string;
  };
  Feature: {
    MULTISELECT_ENABLED: string;
    NAV_HIDDEN: string;
    SUPPORT_DRIVES: string;
  };
  Action: {
    PICKED: string;
    CANCEL: string;
    LOADED: string;
  };
  DocsView: new (viewId?: string) => DocsView;
}

export interface DocsView {
  setIncludeFolders: (include: boolean) => DocsView;
  setSelectFolderEnabled: (enabled: boolean) => DocsView;
  setMimeTypes: (types: string) => DocsView;
  setMode: (mode: string) => DocsView;
  setParent: (parentId: string) => DocsView;
}

export interface PickerBuilder {
  addView: (view: string | DocsView) => PickerBuilder;
  enableFeature: (feature: string) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (appId: string) => PickerBuilder;
  setCallback: (callback: (data: PickerCallbackData) => void) => PickerBuilder;
  setTitle: (title: string) => PickerBuilder;
  build: () => Picker;
}

export interface Picker {
  setVisible: (visible: boolean) => void;
}

export interface PickerCallbackData {
  action: string;
  docs?: PickedDoc[];
}

export interface PickedDoc {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  embedUrl?: string;
  sizeBytes?: number;
  iconUrl?: string;
}

export {};
