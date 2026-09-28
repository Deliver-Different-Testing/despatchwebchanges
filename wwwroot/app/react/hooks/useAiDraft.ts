import {useCallback, useEffect, useRef, useState} from 'react';

/**
 * Shared lifecycle for one-shot Auto-Mate AI drafts. Wraps a fetch function with
 * an AbortController (cancels an in-flight draft if the user clicks again or the
 * component unmounts), an `isDrafting` flag, and silent-abort error handling.
 * Returns the drafted value, or `null` if the request was aborted or errored.
 */
export function useAiDraft() {
    const [isDrafting, setIsDrafting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => () => abortRef.current?.abort(), []);

    const runDraft = useCallback(
        async <T>(fetchFn: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setIsDrafting(true);
            setError(null);
            try {
                return await fetchFn(controller.signal);
            } catch (e: unknown) {
                if (
                    (e instanceof Error && (e.name === 'AbortError' || e.name === 'CanceledError')) ||
                    controller.signal.aborted
                ) {
                    return null;
                }
                setError(e instanceof Error ? e.message : 'Failed to generate draft');
                return null;
            } finally {
                if (abortRef.current === controller) {
                    setIsDrafting(false);
                }
            }
        },
        [],
    );

    return {runDraft, isDrafting, error};
}
