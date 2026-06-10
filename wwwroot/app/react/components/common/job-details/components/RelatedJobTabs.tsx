/**
 * RelatedJobTabs - Tabs for switching between related jobs in a job group
 *
 * Label policy (mirrors RunViewer's relatedJobTabLabel from homeControl.js
 * ~lines 273-286, applied to both recurring and non-recurring families
 * since the 2026-06-10 child-template migrations now populate real
 * ucbkJobNumber on every leg):
 *   - Parent tab (sortedRelatedJobs[0] after the chain-order sort in
 *     useJobDetail.ts) → full jobNo
 *   - Each child tab → '*' + suffix-that-differs-from-parent
 *     (e.g. KT2103CRTLHP under parent KT2103CRT renders as '*LHP')
 *   - Defensive fallbacks for legacy data:
 *       - If a leg's jobNo doesn't share the parent's prefix → full jobNo
 *       - If the leg has no jobNo at all (legacy templates from before
 *         the 2026-04-08 child-template backfill) → 'Job #N' placeholder
 *   - Full jobNo always available on hover via the title attribute.
 */

import React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import type {IJob} from '../JobDetails.types';

interface RelatedJobTabsProps {
    sortedRelatedJobs: IJob[];
    selectedTabIndex: number;
    onTabChange: (index: number) => void;
}

function tabLabel(job: IJob, parent: IJob | undefined, fallbackIndex: number): string {
    const jobNo = job.jobNo ?? '';
    // Legacy recurring templates from before the 2026-04-08 child-template
    // backfill have null ucbkJobNumber - fall through to the placeholder so
    // the tabs aren't blank.
    if (!jobNo) return `Job #${fallbackIndex + 1}`;
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
                    label={tabLabel(job, parent, index)}
                    title={job.jobNo ?? ''}
                />
            ))}
        </Tabs>
    );
}
