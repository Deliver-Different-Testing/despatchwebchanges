/**
 * TotalDistance - Centered distance indicator between address and fields sections.
 */

import React from 'react';
import {Collapse, Group, Text} from '@mantine/core';
import {IconRoute} from '@tabler/icons-react';
import {Icon} from '../../icon/Icon';

interface TotalDistanceProps {
    distance: number;
    isUsCustomer: boolean;
    visible: boolean;
}

export const TotalDistance = React.memo(function TotalDistance({distance, isUsCustomer, visible}: TotalDistanceProps) {
    const unit = isUsCustomer ? 'miles' : 'km';

    // Mantine v9 spells MUI's `in` as `expanded` (an unknown `in` falls through
    // to the DOM and the collapse silently never opens), and `keepMounted={false}`
    // is its `unmountOnExit`: without it the collapsed row stays in the DOM but
    // leaves the a11y tree.
    return (
        <Collapse expanded={visible && !!distance} keepMounted={false}>
            <Group
                justify="center"
                gap={8}
                style={{
                    backgroundColor: 'var(--mantine-color-gray-1)',
                    borderRadius: 'var(--mantine-radius-lg)',
                    border: '1px solid var(--mantine-color-default-border)',
                    paddingBlock: 8,
                    paddingInline: 16,
                }}
            >
                <Icon
                    tabler={IconRoute}
                    size={18}
                    color="var(--mantine-primary-color-filled)"
                    style={{opacity: 0.7}}
                    aria-hidden
                />
                <Text style={{fontSize: '0.875rem', fontWeight: 600}}>
                    {distance ? distance.toFixed(1) : 0} {unit}
                </Text>
            </Group>
        </Collapse>
    );
});
