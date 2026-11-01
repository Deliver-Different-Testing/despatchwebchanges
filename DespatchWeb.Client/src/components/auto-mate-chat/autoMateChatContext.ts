import {createContext, useContext} from 'react';

export interface AutoMateChatContextValue {
    isOpen: boolean;
    chatEnabled: boolean;
    setChatEnabled: (enabled: boolean) => void;
    open: () => void;
    close: () => void;
    toggle: () => void;
}

export const AutoMateChatContext = createContext<AutoMateChatContextValue | null>(null);

export function useAutoMateChat(): AutoMateChatContextValue {
    const ctx = useContext(AutoMateChatContext);
    if (!ctx) throw new Error('useAutoMateChat must be used within AutoMateChatProvider');
    return ctx;
}
