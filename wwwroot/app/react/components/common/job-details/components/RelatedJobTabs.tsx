/**
 * RelatedJobTabs - Tabs for switching between related jobs in a job group
 *
 * Label policy (Kevin 2026-05-26, mirrors RunViewer Detail panel):
 *   - Parent tab (first sibling, shortest jobNo) → full jobNo
 *   - Each child tab → '*' + suffix-that-differs-from-parent
 *     (e.g. KT2103CRTLHP under parent KT2103CRT renders as '*LHP')
 *   - Fallback to full jobNo if the child's jobNo doesn't share the
 *     parent's prefix (heuristic miss)
 *   - Full jobNo always available on hover via the title attribute
 *
 * Applies regardless of isRecurringJob — the parent-first convention is
 * the same shape in both flows, and the operator benefits from seeing the
 * actual job number rather than a generic "Job #1".
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

function tabLabel(job: IJob, parent: IJob | undefined): string {
    const jobNo = job.jobNo ?? '';
    if (!parent || !parent.jobNo) return jobNo;
    if (job.id === parent.id) return parent.jobNo;
    if (jobNo.startsWith(parent.jobNo)) {
        return '*' + jobNo.substring(parent.jobNo.length);
    }
    return jobNo;
}

export function RelatedJobTabs({
    sortedRelatedJobs,
    selectedTabIndex,
    isRecurringJob,
    onTabChange,
}: RelatedJobTabsProps) {
    if (sortedRelatedJobs.length <= 1) return null;

    const parent = sortedRelatedJobs[0];

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
            {sortedRelatedJobs.map((job) => (
                <Tab
                    key={job.id}
                    label={tabLabel(job, parent)}
                    title={job.jobNo}
                />
            ))}
        </Tabs>
    );
}
