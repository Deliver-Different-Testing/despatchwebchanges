/**
 * A filter criterion's label, with the number of options currently chosen.
 *
 * A multi-select has to report its own state: once a group's options scroll, or
 * the panel is scanned rather than read, the label is the only place that can
 * say "this one is doing something". Baymard's faceted-search guidance is to
 * keep current selections visible rather than making people hunt for them — this
 * is that, applied per group instead of as a separate chip strip.
 *
 * Shared by the overview's Quick Filters and the recurring-jobs toolbar, so the
 * two cannot drift.
 */

import React from 'react';
import {Group, Text} from '@mantine/core';
import {groupLabelProps} from './filterFieldTokens';

export interface GroupLabelProps {
    children: string;
    /** Options chosen in this group. Omitted or 0 renders no count. */
    selected?: number;
}

export const GroupLabel: React.FC<GroupLabelProps> = ({children, selected = 0}) => (
    <Group gap={6} wrap="nowrap" align="baseline">
        <Text {...groupLabelProps}>{children}</Text>
        {selected > 0 && (
            <Text {...groupLabelProps} c="var(--mantine-primary-color-filled)" fw={700}>
                {selected}
            </Text>
        )}
    </Group>
);

export default GroupLabel;
