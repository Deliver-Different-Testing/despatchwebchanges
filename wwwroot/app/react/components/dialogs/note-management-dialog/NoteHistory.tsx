import React, {useState} from 'react';
import {Badge, Box, Button, Collapse, Group, Loader, Paper, Stack, Text} from '@mantine/core';
import {ChevronDown, ChevronUp, History, Pencil} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {NoteHistoryProps} from "./NoteHistoryProps";

const captionProps = {size: 'xs', c: 'dimmed', tt: 'uppercase', style: {letterSpacing: 0.5}} as const;

export const NoteHistory: React.FC<NoteHistoryProps> = ({history, isLoading, timeZoneAbbr}) => {
    const [expanded, setExpanded] = useState(false);

    if (isLoading) {
        return (
            <Group gap="xs" mt="md" wrap="nowrap">
                <Loader size={16} role="progressbar" aria-label="Loading edit history"/>
                <Text size="sm" c="dimmed">Loading edit history...</Text>
            </Group>
        );
    }

    if (history.length === 0) return null;

    return (
        <Box mt="md">
            <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                mb="xs"
                onClick={() => setExpanded(!expanded)}
                leftSection={<Icon lucide={History} size={16}/>}
                rightSection={<Icon lucide={expanded ? ChevronUp : ChevronDown} size={16}/>}
            >
                Edit History ({history.length})
            </Button>
            <Collapse expanded={expanded} keepMounted={false}>
                <Stack gap="sm" pr={4} style={{maxHeight: 300, overflowY: 'auto'}}>
                    {history.map((entry) => (
                        <Paper key={entry.noteHistoryId} withBorder radius="md" p="md">
                            {/* Header */}
                            <Group gap="xs" mb="sm" wrap="nowrap">
                                <Box c="dimmed" style={{display: 'flex'}}>
                                    <Icon lucide={Pencil} size={16}/>
                                </Box>
                                <Text size="sm" fw={600}>{entry.editedByName}</Text>
                                <Text size="xs" c="dimmed">{entry.editedAtStr} {timeZoneAbbr}</Text>
                            </Group>

                            {/* Text change */}
                            {entry.oldNoteText !== entry.newNoteText && (
                                <Box mb="xs">
                                    <Text {...captionProps}>Text changed</Text>
                                    <Box
                                        mt={4}
                                        p="sm"
                                        style={{
                                            backgroundColor: 'var(--mantine-color-gray-1)',
                                            borderRadius: 'var(--mantine-radius-sm)',
                                            borderLeft: '3px solid var(--mantine-color-red-4)',
                                        }}
                                    >
                                        <Text size="sm" c="dimmed" style={{whiteSpace: 'pre-wrap'}}>
                                            {entry.oldNoteText}
                                        </Text>
                                    </Box>
                                </Box>
                            )}

                            {/* Type change */}
                            {entry.oldNoteTypeId !== entry.newNoteTypeId && (
                                <Group gap="xs" mb={4} wrap="nowrap">
                                    <Text size="xs" c="dimmed">Type:</Text>
                                    <Badge size="sm" color="gray" variant="light">
                                        {entry.oldNoteTypeName ?? 'Unknown'}
                                    </Badge>
                                    <Text size="xs" c="dimmed">&rarr;</Text>
                                    <Badge size="sm">{entry.newNoteTypeName ?? 'Unknown'}</Badge>
                                </Group>
                            )}

                            {/* Importance change */}
                            {entry.oldIsImportant !== entry.newIsImportant && (
                                <Group gap="xs" wrap="nowrap">
                                    <Text size="xs" c="dimmed">Important:</Text>
                                    <Badge
                                        size="sm"
                                        color={entry.newIsImportant ? 'orange' : 'gray'}
                                        variant="light"
                                    >
                                        {entry.newIsImportant ? 'Marked important' : 'Unmarked important'}
                                    </Badge>
                                </Group>
                            )}
                        </Paper>
                    ))}
                </Stack>
            </Collapse>
        </Box>
    );
};

export default NoteHistory;
