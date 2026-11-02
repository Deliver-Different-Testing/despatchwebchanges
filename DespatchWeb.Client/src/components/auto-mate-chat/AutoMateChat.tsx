import React, {lazy, Suspense} from 'react';
import {useAutoMateChat} from './autoMateChatContext';
import {AutoMateChatButton} from './AutoMateChatButton';

// assistant-ui and the markdown renderer only download once a user has turned the chat on.
const AutoMateChatPanel = lazy(() => import('./AutoMateChatPanel').then(m => ({default: m.AutoMateChatPanel})));

export const AutoMateChat: React.FC = () => {
    const {chatEnabled} = useAutoMateChat();
    if (!chatEnabled) return null;

    return (
        <>
            <AutoMateChatButton/>
            <Suspense fallback={null}>
                <AutoMateChatPanel/>
            </Suspense>
        </>
    );
};
