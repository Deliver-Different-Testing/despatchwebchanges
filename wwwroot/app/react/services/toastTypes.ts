/**
 * Toast type surface.
 *
 * Kept in its own framework-free module so the implementation in
 * `toastService.tsx` can import it without the ~64 type-only consumers having
 * to know where the implementation lives (and without an import cycle).
 */

/**
 * Types that {@link ShowToastFn} accepts. This is the narrow set the AngularJS
 * bridge and every external caller pass through. 'loading' is intentionally
 * NOT a member here — sticky-progress toasts are only reachable via
 * `showLoadingToast`, which returns an explicit handle so the caller is forced
 * to resolve/cancel the in-flight indicator.
 */
export type ToastType = 'success' | 'warning' | 'error' | 'info';

/** Optional action button rendered on the right side of a toast. */
export interface ToastAction {
    label: string;
    onClick: () => void;
}

/** Shared callback type for showing a toast notification */
export type ShowToastFn = (message: string, type: ToastType, action?: ToastAction) => void;

/**
 * Handle returned by `showLoadingToast`. Lets the caller turn the in-flight
 * toast into a final status toast — typically `success` or `error` — once the
 * underlying async work resolves, or dismiss it outright on cancellation.
 */
export interface ToastHandle {
    /** Replace the loading toast in-place with a new message/type. */
    update: (message: string, type: ToastType, action?: ToastAction) => void;
    /** Remove the toast immediately. */
    dismiss: () => void;
}

/** Minimal toast service interface used by dialog modules */
export interface ToastService {
    showToast: ShowToastFn;
}
