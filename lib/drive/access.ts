import { listFilesByQuery } from "./drive";

/**
 * Access setup for the `drive.file` scope.
 *
 * The app can only list files the user granted through the Google Picker.
 * This module tracks whether a user has been through that step on this
 * browser so the onboarding screen appears once, not on every sign-in.
 */

const SETUP_DONE_KEY = "fileon.driveAccess.setupDone";

export interface PickerConfig {
  apiKey: string;
  appId: string;
}

export type PickerConfigResult =
  | { status: "ready"; config: PickerConfig }
  | { status: "unconfigured" }
  | { status: "error" };

let configRequest: { token: string; pending: Promise<PickerConfigResult> } | null = null;

/**
 * Ask the server for Picker credentials. The server checks the Google access
 * token first and reads GOOGLE_PICKER_* from its own environment.
 */
export function loadPickerConfig(token: string): Promise<PickerConfigResult> {
  if (configRequest?.token === token) return configRequest.pending;

  const pending = fetch("/api/picker-config", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
    .then(async (res): Promise<PickerConfigResult> => {
      if (res.status === 503) return { status: "unconfigured" };
      if (!res.ok) return { status: "error" };
      const data = (await res.json()) as { apiKey?: unknown; appId?: unknown };
      if (typeof data.apiKey === "string" && data.apiKey && typeof data.appId === "string" && data.appId) {
        return { status: "ready", config: { apiKey: data.apiKey, appId: data.appId } };
      }
      return { status: "unconfigured" };
    })
    .catch((): PickerConfigResult => ({ status: "error" }))
    .then((result) => {
      if (result.status !== "ready" && configRequest?.pending === pending) configRequest = null;
      return result;
    });

  configRequest = { token, pending };
  return pending;
}

function readDoneList(): string[] {
  try {
    const raw = localStorage.getItem(SETUP_DONE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function hasCompletedAccessSetup(userId: string): boolean {
  return readDoneList().includes(userId);
}

/** True when any account finished setup on this browser (returning user hint). */
export function anyAccessSetupCompleted(): boolean {
  return readDoneList().length > 0;
}

export function markAccessSetupDone(userId: string): void {
  try {
    const list = readDoneList();
    if (!list.includes(userId)) list.push(userId);
    localStorage.setItem(SETUP_DONE_KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable; the probe will decide next time.
  }
}

/** Does the app already see at least one file for this account? */
export async function hasAnyGrantedFile(token: string): Promise<boolean> {
  const res = await listFilesByQuery({ token, q: "trashed = false", pageSize: 1 });
  return res.files.length > 0;
}
