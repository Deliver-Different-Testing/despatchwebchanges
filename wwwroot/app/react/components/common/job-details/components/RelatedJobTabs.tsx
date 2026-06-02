/**
 * RelatedJobTabs - Tabs for switching between related jobs in a job group
 *
 * Label policy:
 *   - Recurring jobs (preBook templates) → synthetic 'Job #N' using the
 *     1-based tab index. The template booking and its legs typically have
 *     null `UcbkJobNumber`, so falling back to a real jobNo just gives
 *     blank tabs. This matches the AngularJS template
 *     (`<span ng-if="::ctrl.isRecurringJob">Job #{{$index + 1}}</span>`).
 *   - Non-recurring jobs (Kevin 2026-05-26, mirrors RunViewer Detail panel):
 *       - Parent tab (first sibling, shortest jobNo) → full jobNo
 *       - Each child tab → '*' + suffix-that-differs-from-parent
 *         (e.g. KT2103CRTLHP under parent KT2103CRT renders as '*LHP')
 *       - Fallback to full jobNo if the child's jobNo doesn't share the
 *         parent's prefix (heuristic miss)
 *   - Full jobNo always available on hover via the title attribute.
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
            {sortedRelatedJobs.map((job, index) => (
                <Tab
                    key={job.id}
                    label={isRecurringJob ? `Job #${index + 1}` : tabLabel(job, parent)}
                    title={job.jobNo ?? ''}
                />
            ))}
        </Tabs>
    );
}
