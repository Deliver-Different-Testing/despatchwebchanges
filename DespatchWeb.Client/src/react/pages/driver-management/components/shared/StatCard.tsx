import React from 'react';
import {Card, Group, Text} from '@mantine/core';

interface StatCardProps {
    value: string | number;
    label: string;
    /** A concrete colour for the top rule, the figure and the glyph. */
    color?: string;
    icon?: React.ReactElement;
}

export const StatCard: React.FC<StatCardProps> = ({value, label, color, icon}) => (
    <Card withBorder p={0} radius="lg" miw={140} style={{flex: 1, overflow: 'hidden'}}>
        {/*
          * The 3px rule is the card's only colour. It is stamped so a test can
          * assert the colour reached the DOM — the bar has no text, no role and
          * nothing else to query it by.
          */}
        <div
            data-stat-accent={color ?? ''}
            style={{height: 3, backgroundColor: color || 'var(--mantine-color-gray-3)'}}
        />
        <div style={{padding: '12px 16px'}}>
            <Group gap={8} wrap="nowrap">
                {icon}
                {/*
                  * Tabular figures, not a monospace face. The MUI original asked for
                  * `monoFontFamily`, which resolves to the *body* font — the name
                  * lies, and it has never rendered monospace. `fontVariantNumeric`
                  * is the part that was doing the work, keeping a column of stat
                  * cards aligned digit-for-digit.
                  */}
                <Text fz="h5" fw={700} c={color} style={{fontVariantNumeric: 'tabular-nums'}}>
                    {value}
                </Text>
            </Group>
            <Text fz="xs" c="dimmed">{label}</Text>
        </div>
    </Card>
);
