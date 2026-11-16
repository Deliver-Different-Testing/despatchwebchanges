import type {ApiError} from '../types';

/**
 * A 409 from the task endpoints carries a message written for the user (a missing staff record, e.g.
 * a login not linked to tucStaff). Anything else stays on the generic text: 500s are sanitised server-side.
 */
export function taskErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as Partial<ApiError> | null;
    return apiError?.status === 409 && typeof apiError.message === 'string' && apiError.message
        ? apiError.message
        : fallback;
}
