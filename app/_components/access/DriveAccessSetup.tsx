"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FolderOpen, Keyboard, Loader2, MousePointerClick, Pause, SkipForward, Square } from "lucide-react";
import { APP_NAME } from "@/lib/config/brand";
import { loadPickerConfig, type PickerConfig, type PickerConfigResult } from "@/lib/drive/access";
import type { PickedDoc } from "@/lib/types/google-types";
import { useGuidedDriveAccess, type GuidedProgress } from "./useGuidedDriveAccess";

interface DriveAccessSetupProps {
  token: string | null;
  /** First sign-in shows "Skip for now"; adding later shows "Cancel". */
  mode: "onboarding" | "add";
  onGranted?: (docs: PickedDoc[]) => void;
  /** Called when the user finishes or skips. */
  onFinished: (summary: { filesGranted: number; foldersGranted: number }) => void;
}

/**
 * Guided grant flow for the `drive.file` scope.
 * Each flat list (folders, photos, documents, …) costs two actions:
 * Ctrl+A, then Select. The next list opens on its own.
 */
export function DriveAccessSetup({ token, mode, onGranted, onFinished }: DriveAccessSetupProps) {
  const [configState, setConfigState] = useState<PickerConfigResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const config: PickerConfig | null = configState?.status === "ready" ? configState.config : null;
  const { progress, start, resume, retry, stop, reset, addMissingFolders } = useGuidedDriveAccess({ token, config, onGranted });
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const selectAll = isMac ? "⌘A" : "Ctrl+A";

  useEffect(() => {
    if (!token) {
      setConfigState({ status: "error" });
      return;
    }
    let cancelled = false;
    setConfigState(null);
    loadPickerConfig(token).then((result) => {
      if (!cancelled) setConfigState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  if (!configState) {
    return (
      <Panel>
        <div className="flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      </Panel>
    );
  }

  if (configState.status !== "ready") {
    return (
      <Panel>
        <Heading
          title={configState.status === "unconfigured" ? "Google Picker is not configured" : "Could not open Google Picker"}
          text={
            configState.status === "unconfigured"
              ? `Set GOOGLE_PICKER_API_KEY and GOOGLE_PICKER_APP_ID on the server so ${APP_NAME} can ask Google which files it may open.`
              : "The Picker credentials could not be loaded. Try again in a moment."
          }
        />
        <div className="mt-8 flex justify-center gap-3">
          {configState.status === "error" && (
            <SecondaryButton onClick={() => setAttempt((n) => n + 1)}>Try again</SecondaryButton>
          )}
          <SecondaryButton onClick={() => onFinished({ filesGranted: 0, foldersGranted: 0 })}>
            {mode === "onboarding" ? "Continue without files" : "Close"}
          </SecondaryButton>
        </div>
      </Panel>
    );
  }

  if (progress.phase === "done") {
    return (
      <Panel>
        <div className="flex justify-center mb-5">
          <span className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
            <CheckCircle2 className="w-7 h-7" strokeWidth={2} />
          </span>
        </div>
        <Heading
          title={progress.filesGranted + progress.foldersGranted > 0 ? "You're set" : "Nothing selected"}
          text={
            progress.filesGranted + progress.foldersGranted > 0
              ? `${APP_NAME} can now see ${plural(progress.filesGranted, "file")} and ${plural(progress.foldersGranted, "folder")}. Add more any time from the sidebar.`
              : `No files were granted. You can add them later from the sidebar.`
          }
        />
        {progress.unplacedFiles > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
            {plural(progress.unplacedFiles, "file")} {progress.unplacedFiles === 1 ? "is" : "are"} in a folder that was not selected, so {progress.unplacedFiles === 1 ? "it shows" : "they show"} in search and type views but not inside that folder.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {progress.unplacedFiles > 0 && (
            <SecondaryButton onClick={() => void addMissingFolders()}>Add their folders</SecondaryButton>
          )}
          <SecondaryButton onClick={reset}>Pick more</SecondaryButton>
          <PrimaryButton onClick={() => onFinished({ filesGranted: progress.filesGranted, foldersGranted: progress.foldersGranted })}>
            {mode === "onboarding" ? `Open ${APP_NAME}` : "Done"}
          </PrimaryButton>
        </div>
      </Panel>
    );
  }

  if (progress.phase === "paused") {
    return (
      <Panel>
        <WalkProgress progress={progress} selectAll={selectAll} />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <SecondaryButton onClick={stop}>
            <Square className="w-3.5 h-3.5" /> Stop here
          </SecondaryButton>
          <SecondaryButton onClick={retry}>
            Try this list again
          </SecondaryButton>
          <PrimaryButton onClick={resume}>
            <SkipForward className="w-4 h-4" /> Skip this list
          </PrimaryButton>
        </div>
      </Panel>
    );
  }

  if (progress.phase === "loading" || progress.phase === "picking") {
    // The Google Picker is a modal iframe over this screen, so no buttons
    // here are reachable while it is open; the walk is driven from the Picker.
    return (
      <Panel>
        <WalkProgress progress={progress} selectAll={selectAll} />
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex justify-center mb-5">
        <span className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
          <FolderOpen className="w-7 h-7" strokeWidth={1.75} />
        </span>
      </div>
      <Heading
        title={mode === "onboarding" ? `Choose what ${APP_NAME} can see` : "Add from Google Drive"}
        text={`${APP_NAME} only sees what you pick. Google opens one list for the whole Drive at a time — folders, then photos, videos, documents, and the other types. A hundred folders is still one list.`}
      />

      <ol className="mt-8 space-y-3 text-left">
        <Step icon={Keyboard} n={1}>
          Scroll to the bottom so the whole list loads, then press <Kbd>{selectAll}</Kbd>.
        </Step>
        <Step icon={MousePointerClick} n={2}>
          Click <strong>Select</strong>. The next list opens on its own.
        </Step>
        <Step icon={SkipForward} n={3}>
          Repeat for each list. Close the Google window to skip one.
        </Step>
      </ol>

      {progress.error && (
        <p className="mt-5 text-sm text-red-600 text-center">{progress.error}</p>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <SecondaryButton onClick={() => onFinished({ filesGranted: 0, foldersGranted: 0 })}>
          {mode === "onboarding" ? "Skip for now" : "Cancel"}
        </SecondaryButton>
        <PrimaryButton onClick={() => void start()} disabled={!token}>
          Open Google Drive picker
        </PrimaryButton>
      </div>
    </Panel>
  );
}

function WalkProgress({ progress, selectAll }: { progress: GuidedProgress; selectAll: string }) {
  const paused = progress.phase === "paused";
  const total = progress.stepsDone + (progress.current ? 1 : 0) + progress.queue.length;
  const pct = total > 0 ? Math.round((progress.stepsDone / total) * 100) : 0;
  const stepNo = progress.stepsDone + 1;

  return (
    <div>
      <div className="flex justify-center mb-5">
        <span className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
          {paused ? <Pause className="w-6 h-6" /> : <Loader2 className="w-6 h-6 animate-spin" />}
        </span>
      </div>
      <Heading
        title={
          paused
            ? `Closed “${progress.current?.label ?? "this list"}”`
            : progress.phase === "loading"
            ? "Opening Google Drive…"
            : progress.current
            ? `${progress.current.label} · ${stepNo} of ${total}`
            : "Opening the next list…"
        }
        text={
          paused
            ? `${plural(progress.queue.length, "list")} left. Open this list again if it had not finished loading, skip it, or stop and keep what you have granted.`
            : `In the Google window, scroll to the bottom, press ${selectAll}, then Select. Close the window to skip this list.`
        }
      />
      {total > 0 && (
        <div className="mt-6">
          <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <span>{plural(progress.filesGranted, "file")} · {plural(progress.foldersGranted, "folder")} granted</span>
            {progress.queue.length > 0 && <span>{plural(progress.queue.length, "list")} left</span>}
          </div>
        </div>
      )}
      {progress.queue.length > 0 && (
        <ul className="mt-4 max-h-32 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 text-left">
          {progress.queue.slice(0, 12).map((f) => (
            <li key={f.id} className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 truncate">
              {f.label}
            </li>
          ))}
          {progress.queue.length > 12 && (
            <li className="px-3 py-1.5 text-xs text-zinc-400">+{progress.queue.length - 12} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-md mx-auto text-center">{children}</div>;
}

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{text}</p>
    </>
  );
}

function Step({ icon: Icon, n, children }: { icon: typeof Keyboard; n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
      <span className="mt-0.5 inline-flex w-6 h-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100 text-[11px] font-semibold text-white dark:text-zinc-900">
        {n}
      </span>
      <Icon className="mt-1 w-4 h-4 shrink-0 text-zinc-400" strokeWidth={1.75} />
      <span className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{children}</span>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] font-mono font-semibold text-zinc-700 dark:text-zinc-200">
      {children}
    </kbd>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
