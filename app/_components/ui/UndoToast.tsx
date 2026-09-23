"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast as sonner } from "sonner";
import { Undo2 } from "lucide-react";
import { UNDO_TOAST_MS } from "@/lib/undo";

const R = 9;
const CIRC = 2 * Math.PI * R;

interface UndoToastCardProps {
  toastId: string | number;
  message: string;
  entryId: string;
  onUndo: (entryId: string) => void;
}

export function UndoToastCard({ toastId, message, entryId, onUndo }: UndoToastCardProps) {
  const [progress, setProgress] = useState(1);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(Date.now());
  const elapsedRef = useRef(0);

  const dismiss = useCallback(() => {
    sonner.dismiss(toastId);
  }, [toastId]);

  useEffect(() => {
    if (paused) return;
    let raf = 0;
    const tick = () => {
      const elapsed = elapsedRef.current + (Date.now() - startRef.current);
      const p = Math.max(0, 1 - elapsed / UNDO_TOAST_MS);
      setProgress(p);
      if (p <= 0) {
        dismiss();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    startRef.current = Date.now();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, dismiss]);

  function handlePause() {
    if (!paused) {
      elapsedRef.current += Date.now() - startRef.current;
      setPaused(true);
    }
  }

  function handleResume() {
    if (paused) {
      startRef.current = Date.now();
      setPaused(false);
    }
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 px-4 py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl shadow-2xl border border-zinc-700 min-w-[280px] max-w-sm pointer-events-auto"
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
    >
      <div className="relative w-6 h-6 shrink-0" aria-hidden>
        <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r={R} fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600" />
          <circle
            cx="12"
            cy="12"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            className="text-blue-400"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="text-sm flex-1 min-w-0 leading-snug">{message}</p>
      <button
        type="button"
        onClick={() => onUndo(entryId)}
        className="text-xs font-semibold text-blue-400 hover:text-blue-300 shrink-0 flex items-center gap-1 transition-colors"
      >
        <Undo2 className="w-3.5 h-3.5" />
        Undo
      </button>
    </div>
  );
}
