import React from 'react';
import {Box, Group, Stack, Text} from '@mantine/core';
import {SymbolIcon} from '../../../components/common/symbol-icon';
import type {OverviewStatsViewModel} from '../OverviewPage.interfaces';
import classes from './StatsTabs.module.css';

interface StatsTabsProps {
    statistics: OverviewStatsViewModel;
    activeTab: number;
    onTabChange: (tab: number) => void;
}

const TAB_CONFIG = [
    {key: 'active', label: 'Active', icon: 'cycle'},
    {key: 'inactive', label: 'Inactive', icon: 'pause_circle'},
    {key: 'completed', label: 'Completed', icon: 'task_alt'},
] as const;

export const StatsTabs: React.FC<StatsTabsProps> = React.memo(({statistics, activeTab, onTabChange}) => {
    return (
        <Group justify="center" gap={32} py={16}>
            {TAB_CONFIG.map((tab, index) => {
                const isActive = activeTab === index;
                const value = statistics[tab.key];

                return (
                    <Stack
                        key={tab.key}
                        align="center"
                        gap={0}
                        onClick={() => onTabChange(index)}
                        // The resting opacity and its hover override live together in
                        // the stylesheet: an inline resting value would outrank the
                        // class rule and make the hover unreachable.
                        className={classes.tab}
                        data-active={isActive}
                    >
                        <Stack
                            w={75}
                            h={75}
                            align="center"
                            justify="center"
                            gap={0}
                            bg={isActive ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-gray-2)'}
                            c={isActive ? 'var(--mantine-primary-color-contrast)' : 'dimmed'}
                            style={{borderRadius: '50%', transition: 'all 0.2s'}}
                        >
                            <Text fz="h6" fw={700} lh={1}>
                                {value}
                            </Text>
                            <SymbolIcon name={tab.icon} size={20} style={{marginTop: 2}} />
                        </Stack>
                        <Text
                            fz="sm"
                            mt={4}
                            fw={isActive ? 600 : 400}
                            c={isActive ? 'var(--mantine-primary-color-filled)' : 'dimmed'}
                        >
                            {tab.label}
                        </Text>
                        {isActive && (
                            <Box
                                w={32}
                                h={3}
                                mt={4}
                                bg="var(--mantine-primary-color-filled)"
                                style={{borderRadius: 'var(--mantine-radius-md)'}}
                            />
                        )}
                    </Stack>
                );
            })}
        </Group>
    );
});
StatsTabs.displayName = 'StatsTabs';

export default StatsTabs;
