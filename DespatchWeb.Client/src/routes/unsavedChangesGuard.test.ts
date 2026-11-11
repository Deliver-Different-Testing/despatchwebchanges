import {confirmNavigationAllowed, registerUnsavedChangesGuard} from './unsavedChangesGuard';

describe('unsavedChangesGuard', () => {
    it('allows navigation when nothing is registered', async () => {
        expect(await confirmNavigationAllowed()).toBe(true);
    });

    it('allows navigation when the registered guard is not dirty', async () => {
        const unregister = registerUnsavedChangesGuard({
            isDirty: () => false,
            promptToLeave: vi.fn(),
            save: vi.fn(),
        });

        expect(await confirmNavigationAllowed()).toBe(true);
        unregister();
    });

    it('prompts when dirty, and blocks navigation on "stay"', async () => {
        const promptToLeave = vi.fn().mockResolvedValue('stay');
        const save = vi.fn();
        const unregister = registerUnsavedChangesGuard({isDirty: () => true, promptToLeave, save});

        expect(await confirmNavigationAllowed()).toBe(false);
        expect(promptToLeave).toHaveBeenCalledTimes(1);
        expect(save).not.toHaveBeenCalled();
        unregister();
    });

    it('discards and allows navigation on "discard"', async () => {
        const save = vi.fn();
        const unregister = registerUnsavedChangesGuard({
            isDirty: () => true,
            promptToLeave: vi.fn().mockResolvedValue('discard'),
            save,
        });

        expect(await confirmNavigationAllowed()).toBe(true);
        expect(save).not.toHaveBeenCalled();
        unregister();
    });

    it('saves then allows navigation on "save-and-leave"', async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const unregister = registerUnsavedChangesGuard({
            isDirty: () => true,
            promptToLeave: vi.fn().mockResolvedValue('save-and-leave'),
            save,
        });

        expect(await confirmNavigationAllowed()).toBe(true);
        expect(save).toHaveBeenCalledTimes(1);
        unregister();
    });

    it('stops checking a guard once unregistered', async () => {
        const promptToLeave = vi.fn();
        const unregister = registerUnsavedChangesGuard({isDirty: () => true, promptToLeave, save: vi.fn()});
        unregister();

        expect(await confirmNavigationAllowed()).toBe(true);
        expect(promptToLeave).not.toHaveBeenCalled();
    });

    it('a later registration replaces the earlier one', async () => {
        const firstPrompt = vi.fn();
        registerUnsavedChangesGuard({isDirty: () => true, promptToLeave: firstPrompt, save: vi.fn()});
        const secondPrompt = vi.fn().mockResolvedValue('discard');
        registerUnsavedChangesGuard({isDirty: () => true, promptToLeave: secondPrompt, save: vi.fn()});

        expect(await confirmNavigationAllowed()).toBe(true);
        expect(firstPrompt).not.toHaveBeenCalled();
        expect(secondPrompt).toHaveBeenCalledTimes(1);
    });
});
