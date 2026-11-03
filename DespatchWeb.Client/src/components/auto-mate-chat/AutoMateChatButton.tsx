import React from 'react';
import {ActionIcon, Tooltip} from '@mantine/core';
import {useAutoMateChat} from './autoMateChatContext';
import {AutoMateLogo} from '../common/auto-mate-logo/AutoMateLogo';

export const AUTO_MATE_CHAT_BUTTON_Z_INDEX = 190;

export const AutoMateChatButton: React.FC = () => {
    const {toggle, isOpen, chatEnabled} = useAutoMateChat();

    if (!chatEnabled || isOpen) return null;

    return (
        <Tooltip label="Auto-mate assistant" position="left">
            <ActionIcon
                onClick={toggle}
                aria-label="Open Auto-mate assistant"
                variant="filled"
                radius="xl"
                size={56}
                style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    boxShadow: 'var(--mantine-shadow-lg)',
                    zIndex: AUTO_MATE_CHAT_BUTTON_Z_INDEX,
                }}
            >
                <AutoMateLogo variant="mono" size={32}/>
            </ActionIcon>
        </Tooltip>
    );
};
