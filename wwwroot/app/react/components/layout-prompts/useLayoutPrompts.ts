/**
 * Layout prompts
 *
 * The AngularJS toolbar drives layout save/rename/delete imperatively: it calls a bridge
 * method and awaits a promise while React puts a dialog on screen. Dispatch and Job Search
 * each carried their own copy of that plumbing three times over — a piece of state, a
 * resolver ref, a prompt that opens, a resolve that closes and settles.
 */

import {useCallback, useRef, useState} from 'react';

export interface LayoutPrompts {
    /** Save dialog is open while a promptSaveLayout() call is pending. */
    saveDialogOpen: boolean;
    promptSaveLayout(): Promise<string | null>;
    resolveSaveLayout(name: string | null): void;

    /** Layout being renamed, or null when the prompt is closed. */
    renameDialogName: string | null;
    promptRenameLayout(layoutName: string): Promise<string | null>;
    resolveRenameLayout(name: string | null): void;

    /** Layout being deleted, or null when the prompt is closed. */
    deleteDialogName: string | null;
    promptDeleteLayout(layoutName: string): Promise<boolean>;
    resolveDeleteLayout(confirmed: boolean): void;
}

/** One prompt: state that doubles as "open", plus the promise the toolbar is waiting on. */
function usePrompt<TState, TResult>(closedState: TState) {
    const [state, setState] = useState<TState>(closedState);
    const resolverRef = useRef<((result: TResult) => void) | null>(null);

    const prompt = useCallback((openState: TState) => new Promise<TResult>(resolve => {
        resolverRef.current = resolve;
        setState(openState);
    }), []);

    const resolve = useCallback((result: TResult) => {
        setState(closedState);
        resolverRef.current?.(result);
        resolverRef.current = null;
        // closedState is a constant per call site.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return [state, prompt, resolve] as const;
}

export function useLayoutPrompts(): LayoutPrompts {
    const [saveDialogOpen, openSave, resolveSaveLayout] = usePrompt<boolean, string | null>(false);
    const [renameDialogName, openRename, resolveRenameLayout] = usePrompt<string | null, string | null>(null);
    const [deleteDialogName, openDelete, resolveDeleteLayout] = usePrompt<string | null, boolean>(null);

    const promptSaveLayout = useCallback(() => openSave(true), [openSave]);
    const promptRenameLayout = useCallback((layoutName: string) => openRename(layoutName), [openRename]);
    const promptDeleteLayout = useCallback((layoutName: string) => openDelete(layoutName), [openDelete]);

    return {
        saveDialogOpen,
        promptSaveLayout,
        resolveSaveLayout,
        renameDialogName,
        promptRenameLayout,
        resolveRenameLayout,
        deleteDialogName,
        promptDeleteLayout,
        resolveDeleteLayout,
    };
}
