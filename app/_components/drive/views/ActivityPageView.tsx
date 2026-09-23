"use client";

import { useEffect, useState } from "react";
import { ActivityView } from "./ActivityView";
import { useDriveBrowse } from "../context/DriveBrowseProvider";
import { isLoggingPaused, setLoggingPaused } from "@/lib/activity-log";

export function ActivityPageView() {
  const { handleOpenFileFromActivity } = useDriveBrowse();
  const [loggingPaused, setLoggingPausedState] = useState(false);

  useEffect(() => {
    setLoggingPausedState(isLoggingPaused());
  }, []);

  function toggleLogging() {
    const next = !loggingPaused;
    setLoggingPaused(next);
    setLoggingPausedState(next);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Activity logging</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {loggingPaused ? "Logging is paused — actions won't be recorded." : "Actions are being recorded locally."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleLogging}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold btn-primary"
        >
          {loggingPaused ? "Resume logging" : "Pause logging"}
        </button>
      </div>
      <ActivityView onOpenFile={handleOpenFileFromActivity} />
    </div>
  );
}
