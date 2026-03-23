/**
 * RelatedJobTabs - Tabs for switching between related jobs in a job group
 */

import React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import type {IJob} from '../JobDetails.types';

interface RelatedJobTabsProps {
    sortedRelatedJobs: IJob[];
    selectedTabIndex: number;
    isRecurringJob: boolean;
    onTabChange: (index: number) => void;
}

export function RelatedJobTabs({
    sortedRelatedJobs,
    selectedTabIndex,
    isRecurringJob,
    onTabChange,
}: RelatedJobTabsProps) {
    if (sortedRelatedJobs.length <= 1) return null;

    return (
        <Tabs
            value={selectedTabIndex}
            onChange={(_e, value: number) => onTabChange(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
                borderBottom: 1,
                borderColor: 'divider',
                minHeight: 36,
                '& .MuiTab-root': {
                    minHeight: 36,
                    py: 0.5,
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                },
                '& .Mui-selected': {
                    fontWeight: 600,
                },
            }}
        >
            {sortedRelatedJobs.map((job, index) => (
                <Tab
                    key={job.id}
                    label={isRecurringJob ? `Job #${index + 1}` : job.jobNo}
                />
            ))}
        </Tabs>
    );
}
