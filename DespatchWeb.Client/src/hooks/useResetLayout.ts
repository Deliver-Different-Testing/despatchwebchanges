import {useCallback} from 'react';

export interface UseResetLayoutOptions {
    currentLayoutName: string | undefined;
    resetCurrentLayout: () => void;
    confirm?: (message: string) => boolean;
}

export function useResetLayout(
    {currentLayoutName, resetCurrentLayout, confirm = message => window.confirm(message)}: UseResetLayoutOptions,
): {resetLayout: () => void} {
    const resetLayout = useCallback(() => {
        const layoutName = currentLayoutName ?? 'Default';
        if (!confirm(
            `Reset "${layoutName}" to the default arrangement? Panel sizes, order and visibility will be restored.`,
        )) return;
        resetCurrentLayout();
    }, [currentLayoutName, resetCurrentLayout, confirm]);

    return {resetLayout};
}
