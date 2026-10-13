import React, {useState} from 'react';
import {Alert, Badge, Box, Checkbox, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput} from '@mantine/core';
import {DateInput} from '@mantine/dates';
import {useDebouncedValue} from '@mantine/hooks';
import {ArrowLeftRight, CircleCheck, Info} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {SearchSelect} from '../../common/search-select/SearchSelect';
import type {ShowToastFn} from '../../../services/toastService';
import type {SwapPodCandidate, SwapPodCandidateQuery, SwapPodResult} from '../../../services/jobApi';
import {dayjs, getInputDateFormat} from '../../../utils/dateUtils';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg, sectionPaperProps} from '../shared/mantine';

const ISO_DATE = 'YYYY-MM-DD';

const STATUS_OPTIONS = [
    {value: '', label: 'Any status'},
    {value: '0', label: 'New'},
    {value: '1', label: 'Dispatched'},
    {value: '2', label: 'Accepted'},
    {value: '6', label: 'Completed'},
];

const STATUS_COLORS: Record<number, string> = {0: 'gray', 1: 'blue', 2: 'cyan', 6: 'green'};

/** The two job numbers being swapped, shown side by side in the confirm step. */
const JobChip: React.FC<{label: string; value: string}> = ({label, value}) => (
    <Box
        p="sm"
        ta="center"
        style={{
            flex: 1,
            borderRadius: 'var(--mantine-radius-sm)',
            backgroundColor: 'var(--mantine-color-brand-light)',
            border: '1px solid var(--mantine-color-brand-3)',
        }}
    >
        <Text fz="xs" c="dimmed">{label}</Text>
        <Text fz="lg" fw={700} c="var(--mantine-color-brand-light-color)">{value}</Text>
    </Box>
);

const CandidateOption: React.FC<{candidate: SwapPodCandidate}> = ({candidate}) => (
    <Stack gap={2}>
        <Group gap="xs" wrap="nowrap">
            <Text fw={600} fz="sm">{candidate.number}</Text>
            <Badge variant="light" size="sm" color={STATUS_COLORS[candidate.statusId] ?? 'gray'}>{candidate.statusName}</Badge>
            <Badge variant="light" size="sm" color={candidate.hasPod ? 'green' : 'gray'}>
                {candidate.hasPod ? 'Has POD' : 'No POD'}
            </Badge>
        </Group>
        <Text fz="xs" c="dimmed" truncate>
            {candidate.customer} · {candidate.fromSuburb} → {candidate.toSuburb}
        </Text>
        <Text fz="xs" c="dimmed" truncate>
            {candidate.courier ? `${candidate.courier} · ` : ''}{dayjs(candidate.date).format(getInputDateFormat())}
        </Text>
    </Stack>
);

export interface SwapPodsDialogProps {
    open: boolean;
    jobNo: string;
    /** The current job's customer, enabling the "Same customer" shortcut. */
    customer?: string;
    onClose: () => void;
    onValidate: (jobNo: string) => Promise<boolean>;
    onSearch: (query: SwapPodCandidateQuery, options?: {signal?: AbortSignal}) => Promise<SwapPodCandidate[]>;
    onSwap: (job1: string, job2: string) => Promise<SwapPodResult | void>;
    showToast: ShowToastFn;
}

type Phase = 'input' | 'confirm';

export function SwapPodsDialog({
    open,
    jobNo,
    customer,
    onClose,
    onValidate,
    onSearch,
    onSwap,
    showToast,
}: SwapPodsDialogProps): React.ReactElement | null {
    const [candidate, setCandidate] = useState<SwapPodCandidate | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [dateFilter, setDateFilter] = useState<string | null>(() => dayjs().format(ISO_DATE));
    const [debouncedCustomer] = useDebouncedValue(customerFilter.trim(), 300);
    const [phase, setPhase] = useState<Phase>('input');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const secondJobNo = candidate?.number ?? '';

    // Reset state when the dialog opens
    React.useEffect(() => {
        if (open) {
            setCandidate(null);
            setStatusFilter('');
            setCustomerFilter('');
            setDateFilter(dayjs().format(ISO_DATE));
            setPhase('input');
            setLoading(false);
            setError(null);
        }
    }, [open]);

    const search = (term: string, options?: {signal?: AbortSignal}): Promise<SwapPodCandidate[]> => onSearch({
        term: term.trim() || undefined,
        statusId: statusFilter === '' ? undefined : Number(statusFilter),
        customer: debouncedCustomer || undefined,
        date: dateFilter ?? undefined,
        excludeJobNumber: jobNo,
    }, options);

    const handleValidate = async (): Promise<void> => {
        if (!secondJobNo) {
            setError('Select a job from the list');
            return;
        }

        if (secondJobNo === jobNo) {
            setError('Select a different job from the current job');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const isValid = await onValidate(secondJobNo);
            if (isValid) {
                setPhase('confirm');
            } else {
                setError(`Job ${secondJobNo} isn't eligible for a POD swap`);
            }
        } catch {
            setError("Couldn't check this job. Check the job number and try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmSwap = async (): Promise<void> => {
        setLoading(true);
        try {
            const result = await onSwap(jobNo, secondJobNo);
            const failed = result?.failedPhotos ?? 0;
            if (failed > 0) {
                showToast(
                    `PODs swapped, but ${failed} photo${failed === 1 ? '' : 's'} couldn't be moved. Check the job photos.`,
                    'warning'
                );
            } else {
                showToast('PODs swapped', 'success');
            }
            onClose();
        } catch {
            showToast("Couldn't swap PODs. Try again.", 'error');
            setLoading(false);
        }
    };

    const handleBackToInput = (): void => {
        setPhase('input');
        setError(null);
    };

    const outcome = candidate?.hasPod
        ? `PODs are exchanged between ${jobNo} and ${secondJobNo}.`
        : `${jobNo} goes back to New/Accepted, ${secondJobNo} becomes Completed.`;

    return (
        <DialogShell opened={open} onClose={loading ? () => {} : onClose} size={620}>
            <DialogHeader
                icon={<Icon lucide={ArrowLeftRight}/>}
                title="Swap PODs"
                subtitle="Move a POD signature between two jobs"
                onClose={onClose}
                closeDisabled={loading}
            />
            <Stack p="lg" gap="md" bg={dialogContentBg}>
                <Alert color="cyan" variant="light" icon={<Icon lucide={Info}/>}>
                    This will move the POD signature from <strong>{jobNo}</strong> to the job you specify, and vice versa.
                </Alert>

                {phase === 'input' ? (
                    <Stack gap="md">
                        <TextInput label="Current job" value={jobNo} disabled/>
                        <SimpleGrid cols={{base: 1, sm: 3}} spacing="sm">
                            <Select
                                label="Status"
                                data={STATUS_OPTIONS}
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v ?? '')}
                                allowDeselect={false}
                                disabled={loading}
                            />
                            <TextInput
                                label="Customer"
                                placeholder="Any customer"
                                value={customerFilter}
                                onChange={(e) => setCustomerFilter(e.currentTarget.value)}
                                disabled={loading}
                            />
                            <DateInput
                                label="Date"
                                value={dateFilter}
                                onChange={setDateFilter}
                                valueFormat={getInputDateFormat()}
                                placeholder="Any date"
                                clearable
                                disabled={loading}
                            />
                        </SimpleGrid>
                        {customer && (
                            <Checkbox
                                label="Same customer"
                                description={customer}
                                checked={customerFilter === customer}
                                onChange={(e) => setCustomerFilter(e.currentTarget.checked ? customer : '')}
                                disabled={loading}
                            />
                        )}
                        <SearchSelect<SwapPodCandidate>
                            key={`${statusFilter}|${debouncedCustomer}|${dateFilter ?? ''}`}
                            label="Second job"
                            placeholder="Search by job number"
                            value={candidate}
                            onChange={(c) => {
                                setCandidate(c);
                                if (error) setError(null);
                            }}
                            search={search}
                            getOptionKey={(c) => c.jobId}
                            getOptionLabel={(c) => c.number}
                            renderOption={(c) => <CandidateOption candidate={c}/>}
                            minSearchLength={0}
                            disabled={loading}
                            error={error ?? undefined}
                            autoFocus
                        />
                    </Stack>
                ) : (
                    <Paper {...sectionPaperProps}>
                        <Group gap="xs" mb="md">
                            <Icon lucide={CircleCheck} size={20} color="var(--mantine-color-green-6)"/>
                            <Text fz="sm" fw={600}>Ready to swap</Text>
                        </Group>
                        <Group gap="md" align="center" wrap="nowrap">
                            <JobChip label="Job 1" value={jobNo}/>
                            <Icon lucide={ArrowLeftRight} size={28} color="var(--mantine-color-dimmed)"/>
                            <JobChip label="Job 2" value={secondJobNo}/>
                        </Group>
                        <Text fz="sm" mt="md">{outcome}</Text>
                    </Paper>
                )}
            </Stack>
            {phase === 'input' ? (
                <DialogFooter
                    onCancel={onClose}
                    onConfirm={handleValidate}
                    confirmLabel={loading ? 'Validating…' : 'Validate'}
                    confirmIcon={<Icon lucide={ArrowLeftRight}/>}
                    confirmDisabled={loading || !candidate}
                    submitting={loading}
                />
            ) : (
                <DialogFooter
                    onCancel={handleBackToInput}
                    cancelLabel="Back"
                    onConfirm={handleConfirmSwap}
                    confirmLabel={loading ? 'Swapping…' : 'Confirm swap'}
                    confirmIcon={<Icon lucide={ArrowLeftRight}/>}
                    submitting={loading}
                />
            )}
        </DialogShell>
    );
}

export default SwapPodsDialog;
