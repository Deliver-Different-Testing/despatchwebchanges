import React, {useEffect, useState} from 'react';
import {Alert, Anchor, Box, Group, Text} from '@mantine/core';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import nationwideApi from '../../../../api/nationwideApi';
import {forwardAirDocumentUrl, type ForwardAirDocumentType} from '../../../../constants/forwardAir';
import type {ForwardAirJob} from '../../../../types/forwardAir';
import {cardNotesContainerStyle} from '../JobDetails.styles';

dayjs.extend(utc);

type LoadState =
    | {kind: 'loading'}
    | {kind: 'error'}
    | {kind: 'ready'; job: ForwardAirJob | null};

const DISPLAY_FORMAT = 'MMM D, HH:mm';

function Field({label, children}: {label: string; children: React.ReactNode}) {
    return (
        <Box>
            <Text fz="xs" c="dimmed" fw={500}>{label}</Text>
            <Text fz="sm" fw={500}>{children}</Text>
        </Box>
    );
}

function DocumentLink({legId, type, children}: {legId: number; type: ForwardAirDocumentType; children: string}) {
    return (
        <Anchor fz="sm" href={forwardAirDocumentUrl(legId, type)} target="_blank" rel="noopener noreferrer">
            {children}
        </Anchor>
    );
}

export function ForwardAirDetails({legId}: {legId: number}) {
    const [state, setState] = useState<LoadState>({kind: 'loading'});

    useEffect(() => {
        let cancelled = false;
        setState({kind: 'loading'});
        nationwideApi.getForwardAirJob(legId)
            .then(job => { if (!cancelled) setState({kind: 'ready', job}); })
            .catch(() => { if (!cancelled) setState({kind: 'error'}); });
        return () => { cancelled = true; };
    }, [legId]);

    if (state.kind === 'loading') return null;

    return (
        <Box style={cardNotesContainerStyle}>
            {state.kind === 'error' && (
                <Text fz="sm" c="dimmed">Forward Air details are unavailable right now.</Text>
            )}
            {state.kind === 'ready' && !state.job && (
                <Text fz="sm" c="dimmed">The Forward Air airbill is not booked yet.</Text>
            )}
            {state.kind === 'ready' && state.job && (
                <ForwardAirJobDetails legId={legId} job={state.job}/>
            )}
        </Box>
    );
}

function ForwardAirJobDetails({legId, job}: {legId: number; job: ForwardAirJob}) {
    return (
        <>
            <Group gap="xl" align="flex-start">
                {job.serviceLevel && <Field label="Service">{job.serviceLevel}</Field>}
                {job.airbillNumber && <Field label="Airbill">{job.airbillNumber}</Field>}
                {job.lastStatusDescription && (
                    <Field label="Last status">
                        {job.lastStatusDescription}
                        {job.lastStatusAtUtc && ` (${dayjs.utc(job.lastStatusAtUtc).local().format(DISPLAY_FORMAT)})`}
                    </Field>
                )}
                {job.etaLocal && (
                    <Field label="Expected arrival">{dayjs(job.etaLocal).format(DISPLAY_FORMAT)}</Field>
                )}
            </Group>
            {job.lastError && (
                <Alert color="red" variant="light" mt="xs" title="Booking error">
                    {job.lastError}
                </Alert>
            )}
            {job.airbillNumber && (
                <Group gap="md" mt="xs">
                    <DocumentLink legId={legId} type="BOL">BOL</DocumentLink>
                    <DocumentLink legId={legId} type="LABEL">Label</DocumentLink>
                    {job.deliveryDocumentAvailable && (
                        <DocumentLink legId={legId} type="DELIVER">Delivery receipt</DocumentLink>
                    )}
                </Group>
            )}
        </>
    );
}
