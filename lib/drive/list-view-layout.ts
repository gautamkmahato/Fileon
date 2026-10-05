/** Shared list-view grid: compact two columns on small screens, full table at lg+. */

export const LIST_VIEW_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_2.25rem] lg:grid-cols-[1fr_180px_160px_120px_40px] gap-2 lg:gap-4";

export const LIST_VIEW_HEADER_GRID =
  "hidden lg:grid grid-cols-[1fr_180px_160px_120px_40px] gap-4";

export const LIST_VIEW_HEADER_CLASS =
  `${LIST_VIEW_HEADER_GRID} px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-700 text-[11px] uppercase tracking-wider font-medium text-zinc-500 bg-zinc-50/40 dark:bg-zinc-800/40`;
