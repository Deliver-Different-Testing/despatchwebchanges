import type {DialogName} from './dialogRegistry';

/** Per-test dialog APIs served by the mocked registry; an unregistered dialog rejects like a failed import. */
export const testDialogs: {[N in DialogName]?: any} = {};

export function resetTestDialogs(): void {
    for (const key of Object.keys(testDialogs)) delete testDialogs[key as DialogName];
}

/** Factory for `vi.mock('…/dialogRegistry', async () => (await import('…/testDialogRegistry')).createDialogRegistryMock())`. */
export async function createDialogRegistryMock() {
    const actual = (await vi.importActual<typeof import('./dialogRegistry')>('./dialogRegistry'));
    const loadDialog = async (name: DialogName) => {
        const dialog = testDialogs[name];
        if (!dialog) throw new Error(`${name} dialog not registered in test`);
        return dialog;
    };
    return {
        ...actual,
        loadDialog,
        requireDialog: (name: DialogName, load = loadDialog) => actual.requireDialog(name, load),
    };
}
