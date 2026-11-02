import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {AutoMateChatContext, type AutoMateChatContextValue} from './autoMateChatContext';
import {AI_CHAT_CHANGED_EVENT, isAiChatEnabled, loadAutoMateFromServer, setAiChatEnabled} from '../../utils/aiSettings';

export const AutoMateChatProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const [chatEnabled, setChatEnabledState] = useState<boolean>(isAiChatEnabled);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const sync = () => {
            const enabled = isAiChatEnabled();
            setChatEnabledState(enabled);
            if (!enabled) setIsOpen(false);
        };
        window.addEventListener(AI_CHAT_CHANGED_EVENT, sync);
        // Carries the setting across devices; the Settings page is not the only place the chat is used.
        void loadAutoMateFromServer().then(sync, () => undefined);
        return () => window.removeEventListener(AI_CHAT_CHANGED_EVENT, sync);
    }, []);

    const setChatEnabled = useCallback((enabled: boolean) => setAiChatEnabled(enabled), []);
    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);

    const value = useMemo<AutoMateChatContextValue>(
        () => ({isOpen, chatEnabled, setChatEnabled, open, close, toggle}),
        [isOpen, chatEnabled, setChatEnabled, open, close, toggle],
    );

    return <AutoMateChatContext.Provider value={value}>{children}</AutoMateChatContext.Provider>;
};
