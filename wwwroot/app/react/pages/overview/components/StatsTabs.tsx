import React from 'react';
import {Box, Typography} from '@mui/material';
import type {OverviewStatsViewModel} from '../OverviewPage.interfaces';

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

export const StatsTabs: React.FC<StatsTabsProps> = ({statistics, activeTab, onTabChange}) => {
    return (
        <Box sx={{display: 'flex', justifyContent: 'center', gap: 4, py: 2}}>
            {TAB_CONFIG.map((tab, index) => {
                const isActive = activeTab === index;
                const value = statistics[tab.key];

                return (
                    <Box
                        key={tab.key}
                        onClick={() => onTabChange(index)}
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer',
                            opacity: isActive ? 1 : 0.6,
                            transition: 'opacity 0.2s',
                            '&:hover': {opacity: 1},
                        }}
                    >
                        <Box
                            sx={{
                                width: 75,
                                height: 75,
                                borderRadius: '50%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: isActive ? 'primary.main' : 'grey.200',
                                color: isActive ? 'primary.contrastText' : 'text.secondary',
                                transition: 'all 0.2s',
                            }}
                        >
                            <Typography variant="h6" sx={{fontWeight: 700, lineHeight: 1}}>
                                {value}
                            </Typography>
                            <span className="material-symbols-outlined" style={{fontSize: 20, marginTop: 2}}>
                                {tab.icon}
                            </span>
                        </Box>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 0.5,
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? 'primary.main' : 'text.secondary',
                            }}
                        >
                            {tab.label}
                        </Typography>
                        {isActive && (
                            <Box
                                sx={{
                                    width: 32,
                                    height: 3,
                                    borderRadius: 1.5,
                                    bgcolor: 'primary.main',
                                    mt: 0.5,
                                }}
                            />
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};

export default StatsTabs;
