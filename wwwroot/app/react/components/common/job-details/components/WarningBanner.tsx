/**
 * WarningBanner - Displays warning alerts for archived/recurring/bulk jobs.
 * Matches AngularJS warning section: left accent border, subtle shadow.
 */

import React from 'react';
import Alert from '@mui/material/Alert';
import type {IJob} from '../JobDetails.types';

interface WarningBannerProps {
    job: IJob;
}

export const WarningBanner = React.memo(function WarningBanner({job}: WarningBannerProps) {
    if (!job.isArchived && !job.preBook && !job.isBulkJob) return null;

    let message: string;
    let severity: 'warning' | 'info' = 'warning';
    if (job.isArchived) {
        message = "This job is archived. Some fields can't be edited.";
    } else if (job.isBulkJob) {
        message = 'Bulk job — changes apply to all matching records.';
    } else {
        message = 'Recurring job — some fields may require confirmation.';
        severity = 'info';
    }

    return (
        <Alert
            severity={severity}
            variant="standard"
            sx={{
                borderRadius: 0,
                py: 0.5,
                '& .MuiAlert-icon': {fontSize: 18, py: 0.5},
                '& .MuiAlert-message': {fontSize: '0.75rem', fontWeight: 500, py: 0.25},
            }}
        >
            {message}
        </Alert>
    );
});
