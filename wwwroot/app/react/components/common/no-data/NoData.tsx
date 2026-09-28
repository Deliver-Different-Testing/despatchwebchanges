/**
 * NoData Component
 *
 * Displays an empty state message with an icon and optional action button.
 * Used when there is no data to display in a section.
 */

import React from 'react';
import {Button, Stack, Text, Title} from '@mantine/core';
import {Info} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {NoDataProps} from "./types";
import classes from './NoData.module.css';

/**
 * NoData Component - displays an empty state with icon, title, message, and optional action
 */
export const NoData: React.FC<NoDataProps> = ({
                                                  title = 'No Data',
                                                  message = 'No items to display.',
                                                  icon = <Icon lucide={Info}/>,
                                                  showAction = false,
                                                  actionText = 'Refresh',
                                                  onAction,
                                              }) => {
    // React callers pass an icon element (preferred); the AngularJS `no-data-react`
    // bridge passes a string ligature, which we render via the Material Symbols font
    // for backward compatibility.
    const iconNode = typeof icon === 'string'
        ? (
            <Text
                component="span"
                c="dimmed"
                style={{
                    fontFamily: 'Material Symbols Outlined',
                    fontSize: 48,
                    lineHeight: 1,
                    overflow: 'visible',
                }}
            >
                {icon}
            </Text>
        )
        : (
            // The slot sizes whatever glyph the caller handed over — see the stylesheet.
            <Text component="span" c="dimmed" className={classes.iconSlot} style={{display: 'inline-flex'}}>
                {icon}
            </Text>
        );

    return (
        <Stack align="center" justify="center" gap={0} p="lg" ta="center" mih={200}>
            <Text component="span" opacity={0.7} mb="xs">
                {iconNode}
            </Text>
            {/* A real heading, as the MUI `Typography variant="h6"` was — a bare `Text`
                would quietly drop the role that callers' tests query by. */}
            <Title order={3} size="h5" fw={600} mb="xs">
                {title}
            </Title>
            <Text size="sm" c="dimmed" mb="md" maw={240}>
                {message}
            </Text>
            {showAction && (
                <Button onClick={() => onAction?.()}>
                    {actionText}
                </Button>
            )}
        </Stack>
    );
};

export default NoData;
