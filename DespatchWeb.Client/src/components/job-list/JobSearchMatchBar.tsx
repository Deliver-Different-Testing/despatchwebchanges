import React from 'react';
import {Button, Group, Text} from '@mantine/core';

interface JobSearchMatchBarProps {
    label: string;
    onSearchAnywhere: () => void;
}

/**
 * Says how a job-number search matched, so an exact or "starts with" result is never mistaken for
 * every job containing the term, and offers the wider search in one click.
 */
export const JobSearchMatchBar: React.FC<JobSearchMatchBarProps> = ({label, onSearchAnywhere}) => (
    <Group
        data-testid="job-search-match-bar"
        justify="space-between"
        align="center"
        gap="xs"
        px="md"
        py={2}
        wrap="nowrap"
        style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
    >
        <Text size="xs" c="dimmed" truncate>{label}</Text>
        <Button variant="subtle" size="compact-xs" onClick={onSearchAnywhere}>
            Search anywhere in job number
        </Button>
    </Group>
);
