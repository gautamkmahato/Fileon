import { toast as sonner } from "sonner";

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

interface ToastOpts {
  action?: ToastAction;
  duration?: number;
  id?: string | number;
}

function mapAction(action?: ToastAction) {
  if (!action) return undefined;
  return { label: action.label, onClick: action.onClick };
}

export const toast = {
  success: (message: string, opts?: ToastOpts) =>
    sonner.success(message, {
      id: opts?.id,
      duration: opts?.duration ?? 4000,
      action: mapAction(opts?.action),
    }),
  error: (message: string, opts?: ToastOpts) =>
    sonner.error(message, {
      id: opts?.id,
      duration: opts?.duration ?? 6000,
      action: mapAction(opts?.action),
    }),
  info: (message: string, opts?: ToastOpts) =>
    sonner.info(message, {
      id: opts?.id,
      duration: opts?.duration ?? 4000,
      action: mapAction(opts?.action),
    }),
  loading: (message: string, opts?: { id?: string | number }) =>
    sonner.loading(message, opts),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};

/** Run an async operation with a loading → success/error toast lifecycle. */
export async function runAsync<T>(opts: {
  loading: string;
  success?: string | ((result: T) => string) | false;
  error?: string | ((err: unknown) => string);
  action?: ToastAction;
  fn: () => Promise<T>;
}): Promise<T | undefined> {
  const id = sonner.loading(opts.loading);
  try {
    const result = await opts.fn();
    if (opts.success === false) {
      sonner.dismiss(id);
    } else {
      const msg = typeof opts.success === "function"
        ? opts.success(result)
        : (opts.success ?? "Done");
      sonner.success(msg, { id, duration: 4000, action: mapAction(opts.action) });
    }
    return result;
  } catch (err) {
    console.error(err);
    const msg = opts.error
      ? typeof opts.error === "function"
        ? opts.error(err)
        : opts.error
      : "Something went wrong";
    sonner.error(msg, { id, duration: 6000 });
    return undefined;
  }
}

/** Update an in-progress loading toast (e.g. multi-step uploads). */
export function updateLoading(message: string, id: string | number) {
  sonner.loading(message, { id });
}
