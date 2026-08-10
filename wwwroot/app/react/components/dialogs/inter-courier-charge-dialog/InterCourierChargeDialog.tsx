/**
 * Inter-Courier Charge Dialog (React)
 *
 * Replaces the AngularJS inter-courier-charge-dialog.
 * Allows dispatchers to create paired inter-courier charge jobs.
 */

import React, {useState, useCallback, useEffect} from 'react';
import {Box, Group, Paper, Stack, TextInput} from '@mantine/core';
import {Banknote, Check} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {SearchSelect} from '../../common/search-select/SearchSelect';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg, sectionPaperProps} from '../shared/mantine';
import {searchActiveCouriers} from '../../../services/courierApi';
import {searchActiveClients} from '../../../services/jobApi';
import {createInterCourierCharge} from '../../../services/dispatchExecutorApi';
import type {Suggestion} from '../../../interfaces/job';
import type {ShowToastFn} from '../../../services/toastService';

const ZONES_MULTIPLIER = 7;

export interface InterCourierChargeDialogProps {
    open: boolean;
    onClose: () => void;
    showToast: ShowToastFn;
}

const suggestionKey = (option: Suggestion) => option.id;
const suggestionLabel = (option: Suggestion) => option.text;

export const InterCourierChargeDialog: React.FC<InterCourierChargeDialogProps> = ({
    open,
    onClose,
    showToast,
}) => {
    const [fromCourier, setFromCourier] = useState<Suggestion | null>(null);
    const [toCourier, setToCourier] = useState<Suggestion | null>(null);
    const [client, setClient] = useState<Suggestion | null>(null);
    const [reference, setReference] = useState('');
    const [zones, setZones] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Reset state when dialogue opens
    useEffect(() => {
        if (open) {
            setFromCourier(null);
            setToCourier(null);
            setClient(null);
            setReference('');
            setZones('');
            setAmount('');
            setIsSubmitting(false);
            setSubmitted(false);
        }
    }, [open]);

    const handleZonesChange = useCallback((value: string) => {
        setZones(value);
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
            setAmount(String(parsed * ZONES_MULTIPLIER));
        } else {
            setAmount('0');
        }
    }, []);

    const isFormValid = fromCourier && toCourier && client
        && reference.trim() !== '' && zones !== '' && amount !== ''
        && !isNaN(parseFloat(zones)) && !isNaN(parseFloat(amount))
        && parseFloat(zones) >= 0 && parseFloat(amount) >= 0;

    const handleSubmit = useCallback(async () => {
        setSubmitted(true);

        if (!isFormValid) {
            showToast('Please complete all the required fields', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            await createInterCourierCharge({
                fromCourierId: fromCourier!.id,
                toCourierId: toCourier!.id,
                clientId: client!.id,
                reference: reference.trim(),
                amount: parseFloat(amount),
            });

            showToast('Inter-Courier Charge saved successfully', 'success');
            onClose();
        } catch (error) {
            showToast('An error occurred while saving the charge', 'error');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }, [fromCourier, toCourier, client, reference, amount, showToast, onClose]);

    const handleClose = useCallback(() => {
        if (!isSubmitting) onClose();
    }, [isSubmitting, onClose]);

    const searchFieldError = (selected: unknown) => (submitted && !selected ? 'This field is required.' : undefined);

    return (
        <DialogShell opened={open} onClose={handleClose}>
            <DialogHeader
                icon={<Icon lucide={Banknote} />}
                title="Inter-Courier Charge"
                subtitle="Create a charge transfer between couriers"
                onClose={handleClose}
                closeDisabled={isSubmitting}
            />
            {/* Content */}
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Paper {...sectionPaperProps} p="lg">
                    <Stack gap="lg">
                        <SearchSelect<Suggestion>
                            label="From Courier"
                            placeholder="Search Courier..."
                            value={fromCourier}
                            onChange={setFromCourier}
                            search={searchActiveCouriers}
                            getOptionKey={suggestionKey}
                            getOptionLabel={suggestionLabel}
                            error={searchFieldError(fromCourier)}
                            withAsterisk
                            autoFocus
                        />
                        <SearchSelect<Suggestion>
                            label="To Courier"
                            placeholder="Search Courier..."
                            value={toCourier}
                            onChange={setToCourier}
                            search={searchActiveCouriers}
                            getOptionKey={suggestionKey}
                            getOptionLabel={suggestionLabel}
                            error={searchFieldError(toCourier)}
                            withAsterisk
                        />
                        <SearchSelect<Suggestion>
                            label="Client"
                            placeholder="Search Client..."
                            value={client}
                            onChange={setClient}
                            search={searchActiveClients}
                            getOptionKey={suggestionKey}
                            getOptionLabel={suggestionLabel}
                            error={searchFieldError(client)}
                            withAsterisk
                        />

                        <TextInput
                            label="Reference"
                            placeholder="Enter reference"
                            withAsterisk
                            value={reference}
                            onChange={(e) => setReference(e.currentTarget.value)}
                            error={submitted && reference.trim() === '' ? 'This field is required.' : undefined}
                        />

                        <Group gap="md" align="flex-start" grow>
                            <TextInput
                                label="Zones"
                                type="number"
                                withAsterisk
                                min={0}
                                value={zones}
                                onChange={(e) => handleZonesChange(e.currentTarget.value)}
                                error={
                                    submitted && zones === '' ? 'This field is required.'
                                        : submitted && parseFloat(zones) < 0 ? 'Value must be zero or greater.'
                                            : undefined
                                }
                            />
                            <TextInput
                                label="Amount"
                                type="number"
                                withAsterisk
                                min={0}
                                step={0.01}
                                value={amount}
                                onChange={(e) => setAmount(e.currentTarget.value)}
                                error={
                                    submitted && amount === '' ? 'This field is required.'
                                        : submitted && parseFloat(amount) < 0 ? 'Value must be zero or greater.'
                                            : undefined
                                }
                            />
                        </Group>
                    </Stack>
                </Paper>
            </Box>
            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleSubmit}
                confirmLabel="Add Charge"
                confirmIcon={<Icon lucide={Check} />}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default InterCourierChargeDialog;
