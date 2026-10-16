/**
 * WarningBanner - Displays warning alerts for archived/recurring/bulk jobs.
 * Matches AngularJS warning section: left accent border, subtle shadow.
 */

import React from 'react';
import {Alert} from '@mantine/core';
import {Info, TriangleAlert} from 'lucide-react';
import {Icon} from '../../icon/Icon';
import type {IJob} from '../JobDetails.types';

/** Squared off and tight — the banner spans the full width of the job card. */
const bannerStyles = {
    root: {borderRadius: 0, paddingBlock: 4},
    message: {fontSize: '0.75rem', fontWeight: 500},
};

export const WarningBanner = React.memo(function WarningBanner({job}: {job: IJob}) {
    if (!job.isArchived && !job.preBook && !job.isBulkJob) return null;

    let message: string;
    // Mantine has no `severity`, so the two states carry their own colour and
    // glyph: warning orange for the two blocking states, info blue for recurring.
    let color = 'orange';
    let glyph = TriangleAlert;
    if (job.isArchived) {
        message = "This job is archived. Some fields can't be edited.";
    } else if (job.isBulkJob) {
        message = 'Bulk job — changes apply to all matching records.';
    } else {
        message = 'Recurring job — some fields may require confirmation.';
        color = 'reflex';
        glyph = Info;
    }

    return (
        <Alert
            role="alert"
            color={color}
            variant="light"
            icon={<Icon lucide={glyph} size={18}/>}
            styles={bannerStyles}
        >
            {message}
        </Alert>
    );
});
