/**
 * useLayoutPrompts tests
 *
 * The AngularJS toolbar awaits the promise these prompts return, so the contract that
 * matters is: opening leaves the promise pending, resolving settles it exactly once and
 * closes the dialog, and a cancel resolves with the "nothing happened" value.
 */

import {act, renderHook} from '@testing-library/react';
import {useLayoutPrompts} from './useLayoutPrompts';

describe('useLayoutPrompts', () => {
    it('opens the save prompt and resolves with the entered name', async () => {
        const {result} = renderHook(() => useLayoutPrompts());
        expect(result.current.saveDialogOpen).toBe(false);

        let pending!: Promise<string | null>;
        act(() => {
            pending = result.current.promptSaveLayout();
        });
        expect(result.current.saveDialogOpen).toBe(true);

        act(() => result.current.resolveSaveLayout('Morning'));

        await expect(pending).resolves.toBe('Morning');
        expect(result.current.saveDialogOpen).toBe(false);
    });

    it('carries the layout name through the rename prompt', async () => {
        const {result} = renderHook(() => useLayoutPrompts());

        let pending!: Promise<string | null>;
        act(() => {
            pending = result.current.promptRenameLayout('Morning');
        });
        expect(result.current.renameDialogName).toBe('Morning');

        act(() => result.current.resolveRenameLayout(null));

        await expect(pending).resolves.toBeNull();
        expect(result.current.renameDialogName).toBeNull();
    });

    it('resolves the delete prompt with the confirmation', async () => {
        const {result} = renderHook(() => useLayoutPrompts());

        let pending!: Promise<boolean>;
        act(() => {
            pending = result.current.promptDeleteLayout('Morning');
        });
        expect(result.current.deleteDialogName).toBe('Morning');

        act(() => result.current.resolveDeleteLayout(true));

        await expect(pending).resolves.toBe(true);
        expect(result.current.deleteDialogName).toBeNull();
    });

    it('leaves a second resolve inert once the prompt has settled', async () => {
        const {result} = renderHook(() => useLayoutPrompts());
        const settled: (boolean | null)[] = [];

        act(() => {
            void result.current.promptDeleteLayout('Morning').then(v => settled.push(v));
        });
        act(() => result.current.resolveDeleteLayout(true));
        act(() => result.current.resolveDeleteLayout(false));
        await Promise.resolve();

        expect(settled).toEqual([true]);
    });

    it('keeps the three prompts independent', () => {
        const {result} = renderHook(() => useLayoutPrompts());

        act(() => {
            void result.current.promptSaveLayout();
        });

        expect(result.current.saveDialogOpen).toBe(true);
        expect(result.current.renameDialogName).toBeNull();
        expect(result.current.deleteDialogName).toBeNull();
    });
});
