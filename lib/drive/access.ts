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

/** Picker credentials from the environment, or null when not configured. */
export function getPickerConfig(): PickerConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
  if (!apiKey || !appId) return null;
  return { apiKey, appId };
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
