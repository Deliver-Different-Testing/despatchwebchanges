import React from 'react';
import {Group, Text} from '@mantine/core';
import {AutoMateLogo} from './AutoMateLogo';

interface AutoMateCardHeaderProps {
    title: string;
    accent: string;
    collapsible?: boolean;
    expanded: boolean;
    onToggle: () => void;
    /** Badges shown after the title. */
    badges: React.ReactNode;
    /** Right-hand controls. */
    children: React.ReactNode;
}

/** Collapsible header strip shared by the Auto-Mate cards. */
export const AutoMateCardHeader: React.FC<AutoMateCardHeaderProps> = ({
    title, accent, collapsible, expanded, onToggle, badges, children,
}) => (
    <Group
        justify="space-between"
        px="md"
        py={10}
        onClick={collapsible ? onToggle : undefined}
        onKeyDown={collapsible ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle();
            }
        } : undefined}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? expanded : undefined}
        style={{
            backgroundColor: `color-mix(in srgb, ${accent} 8%, transparent)`,
            cursor: collapsible ? 'pointer' : undefined,
            userSelect: collapsible ? 'none' : undefined,
        }}
    >
        <Group gap="xs">
            <AutoMateLogo size={24}/>
            <Text size="sm" fw={600}>{title}</Text>
            {badges}
        </Group>
        <Group gap={4}>{children}</Group>
    </Group>
);
