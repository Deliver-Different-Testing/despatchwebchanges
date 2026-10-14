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
import {Tabs} from '@mantine/core';
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

    // Mantine keys tabs by string, so the index round-trips through `String`.
    return (
        <Tabs
            value={String(selectedTabIndex)}
            onChange={(value) => onTabChange(Number(value))}
            styles={{
                tab: {
                    minHeight: 36,
                    paddingBlock: 4,
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                },
            }}
        >
            <Tabs.List style={{flexWrap: 'nowrap', overflowX: 'auto', minHeight: 36}}>
                {sortedRelatedJobs.map((job, index) => (
                    <Tabs.Tab
                        key={job.id}
                        value={String(index)}
                        title={job.jobNo ?? ''}
                    >
                        {tabLabel(job, parent, index)}
                    </Tabs.Tab>
                ))}
            </Tabs.List>
        </Tabs>
    );
}
