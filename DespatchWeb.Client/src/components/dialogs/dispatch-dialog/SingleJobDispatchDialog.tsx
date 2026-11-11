import React from 'react';
import {getActivePartnerOptions, getPartnerRateForJob} from '../../../api/jobListApi';
import type {DispatchJob} from '../../../types/dispatchJob';
import {DispatchDialog} from './index';
import type {DispatchDialogProps} from './types';
import {isNetworkPartnerSession, stopJobCountFor} from './dispatchSession';

interface SingleJobDispatchDialogProps {
    job: DispatchJob;
    open: boolean;
    onClose: () => void;
    onDispatchCourier: DispatchDialogProps['onDispatchCourier'];
    onSendToPartner: DispatchDialogProps['onSendToPartner'];
}

export const SingleJobDispatchDialog: React.FC<SingleJobDispatchDialogProps> = ({
    job, open, onClose, onDispatchCourier, onSendToPartner,
}) => (
    <DispatchDialog
        open={open}
        mode={{
            kind: 'single',
            jobId: job.id,
            jobNo: job.jobNo,
            flags: {
                isArchived: Boolean(job.isArchived),
                isBulkJob: Boolean(job.isBulkJob),
                preBook: Boolean(job.preBook),
            },
        }}
        existingDestination={job.assignedCourier}
        stopJobCount={stopJobCountFor(job.jobNo, job.relatedJobs)}
        existingConNote={job.conNote}
        isNetworkPartner={isNetworkPartnerSession()}
        onClose={onClose}
        onDispatchCourier={onDispatchCourier}
        onSendToPartner={onSendToPartner}
        fetchRate={getPartnerRateForJob}
        getPartnerOptions={getActivePartnerOptions}
    />
);
