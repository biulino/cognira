/**
 * Global toast bridge — allows non-React code (api.ts, etc.) to fire toasts
 * without prop-drilling or context.
 *
 * Usage:
 *   1. `ToastProvider` calls `registerGlobalToast(functions)` on mount.
 *   2. api.ts (or any module) calls `globalToast.error(...)`.
 */

type ToastFn = (title: string, message?: string) => void;

interface GlobalToastFns {
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  warning: ToastFn;
}

let _fns: GlobalToastFns | null = null;

export function registerGlobalToast(fns: GlobalToastFns) {
  _fns = fns;
}

export const globalToast = {
  success: (title: string, msg?: string) => _fns?.success(title, msg),
  error:   (title: string, msg?: string) => _fns?.error(title, msg),
  info:    (title: string, msg?: string) => _fns?.info(title, msg),
  warning: (title: string, msg?: string) => _fns?.warning(title, msg),
};
