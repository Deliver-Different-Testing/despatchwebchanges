import {confirmNavigationAllowed, registerUnsavedChangesGuard} from './unsavedChangesGuard';

describe('unsavedChangesGuard', () => {
    it('allows navigation when nothing is registered', async () => {
        expect(await confirmNavigationAllowed()).toBe(true);
    });

    it('allows navigation when the registered guard is not dirty', async () => {
        const unregister = registerUnsavedChangesGuard({
            isDirty: () => false,
            promptToLeave: jest.fn(),
            save: jest.fn(),
        });

        expect(await confirmNavigationAllowed()).toBe(true);
        unregister();
    });

    it('prompts when dirty, and blocks navigation on "stay"', async () => {
        const promptToLeave = jest.fn().mockResolvedValue('stay');
        const save = jest.fn();
        const unregister = registerUnsavedChangesGuard({isDirty: () => true, promptToLeave, save});

        expect(await confirmNavigationAllowed()).toBe(false);
        expect(promptToLeave).toHaveBeenCalledTimes(1);
        expect(save).not.toHaveBeenCalled();
        unregister();
    });

    it('discards and allows navigation on "discard"', async () => {
        const save = jest.fn();
        const unregister = registerUnsavedChangesGuard({
            isDirty: () => true,
            promptToLeave: jest.fn().mockResolvedValue('discard'),
            save,
        });

        expect(await confirmNavigationAllowed()).toBe(true);
        expect(save).not.toHaveBeenCalled();
        unregister();
    });

    it('saves then allows navigation on "save-and-leave"', async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        const unregister = registerUnsavedChangesGuard({
            isDirty: () => true,
            promptToLeave: jest.fn().mockResolvedValue('save-and-leave'),
            save,
        });

        expect(await confirmNavigationAllowed()).toBe(true);
        expect(save).toHaveBeenCalledTimes(1);
        unregister();
    });

    it('stops checking a guard once unregistered', async () => {
        const promptToLeave = jest.fn();
        const unregister = registerUnsavedChangesGuard({isDirty: () => true, promptToLeave, save: jest.fn()});
        unregister();

        expect(await confirmNavigationAllowed()).toBe(true);
        expect(promptToLeave).not.toHaveBeenCalled();
    });

    it('a later registration replaces the earlier one', async () => {
        const firstPrompt = jest.fn();
        registerUnsavedChangesGuard({isDirty: () => true, promptToLeave: firstPrompt, save: jest.fn()});
        const secondPrompt = jest.fn().mockResolvedValue('discard');
        registerUnsavedChangesGuard({isDirty: () => true, promptToLeave: secondPrompt, save: jest.fn()});

        expect(await confirmNavigationAllowed()).toBe(true);
        expect(firstPrompt).not.toHaveBeenCalled();
        expect(secondPrompt).toHaveBeenCalledTimes(1);
    });
});
