/**
 * Inter-Courier Charge Dialog (React)
 *
 * An inter-courier charge is a double entry: the backend writes one phantom job
 * against the from-courier for a negative amount and one against the to-courier
 * for the positive (see `JobRepository.BuildIccJobPair`). The dialog showed six
 * flat fields and none of that, so a from/to mix-up was invisible until two
 * uncorrectable jobs existed. The ledger strip below the form now shows exactly
 * what will be recorded, before it is.
 */

import React, {useState, useCallback, useEffect, useId, useMemo} from 'react';
import {Anchor, Badge, Box, Divider, Group, Paper, Stack, Text, TextInput, NumberInput} from '@mantine/core';
import {Banknote, Plus} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {SearchSelect} from '../../common/search-select/SearchSelect';
import {
    DialogShell,
    DialogHeader,
    DialogFooter,
    dialogContentBg,
    sectionLabelProps,
    sectionPaperProps,
} from '../shared/mantine';
import {searchActiveCouriers} from '../../../services/courierApi';
import {searchActiveClients} from '../../../services/jobApi';
import {createInterCourierCharge} from '../../../services/dispatchExecutorApi';
import {formatCurrency} from '../../../utils/currencyUtils';
import type {Suggestion} from '../../../interfaces/job';
import type {ShowToastFn} from '../../../services/toastService';

/** What one zone is worth. The amount defaults to zones x this. */
const ZONE_RATE = 7;

/** `tucJob.UcjbClientRefa` is nvarchar(20); the backend truncates silently past it. */
const REFERENCE_MAX = 20;

/** The true minus sign — reads as "minus", and lines up with the plus. */
const MINUS = '−';

/** Nothing to show yet — the same em dash `formatCurrencyOrDash` uses. */
const EM_DASH = '—';

const suggestionKey = (option: Suggestion) => option.id;
const suggestionLabel = (option: Suggestion) => option.text;

/** Money in a ledger column: same width per digit, so the two rows align. */
const ledgerFigureStyle: React.CSSProperties = {fontVariantNumeric: 'tabular-nums'};

/**
 * One side of the entry. The sign and the eyebrow carry the direction; the colour
 * only reinforces it, so the row still reads without it.
 */
const LedgerRow: React.FC<{
    eyebrow: string;
    courier: Suggestion | null;
    amount: number | null;
    sign: '+' | typeof MINUS;
    color: string;
}> = ({eyebrow, courier, amount, sign, color}) => (
    <Group justify="space-between" wrap="nowrap" gap="sm" px="md" py={10}>
        <Group gap="sm" wrap="nowrap" miw={0}>
            <Text fz={10} fw={700} tt="uppercase" lts={0.8} c="dimmed" w={64} style={{flexShrink: 0}}>
                {eyebrow}
            </Text>
            <Text fz="sm" truncate c={courier ? undefined : 'dimmed'}>
                {courier ? courier.text : EM_DASH}
            </Text>
        </Group>
        <Text fz="sm" fw={600} c={amount === null ? 'dimmed' : color} style={ledgerFigureStyle}>
            {amount === null ? EM_DASH : `${sign}${formatCurrency(amount)}`}
        </Text>
    </Group>
);

export interface InterCourierChargeDialogProps {
    open: boolean;
    onClose: () => void;
    showToast: ShowToastFn;
}

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
    const [submitAttempt, setSubmitAttempt] = useState(0);

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
            setSubmitAttempt(0);
        }
    }, [open]);

    const handleZonesChange = useCallback((value: string) => {
        setZones(value);
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
            setAmount(String(parsed * ZONE_RATE));
        } else {
            setAmount('0');
        }
    }, []);

    const parsedZones = parseFloat(zones);
    const parsedAmount = parseFloat(amount);

    /** The amount the zone rate would give, or null while zones is unusable. */
    const zoneRateAmount = Number.isFinite(parsedZones) ? parsedZones * ZONE_RATE : null;

    /* The amount is seeded from zones but stays editable, and the two used to
       drift with nothing on screen to say so. */
    const isOverridden = zoneRateAmount !== null
        && Number.isFinite(parsedAmount)
        && parsedAmount !== zoneRateAmount;

    const sameCourier = Boolean(fromCourier && toCourier && fromCourier.id === toCourier.id);

    const fromCourierError = submitted && !fromCourier ? 'Choose the courier being charged.' : undefined;
    const toCourierError = sameCourier
        ? "Pick a different courier. A charge can't go to and from the same one."
        : submitted && !toCourier ? 'Choose the courier being credited.' : undefined;
    const clientError = submitted && !client ? 'Choose the client to bill.' : undefined;
    const referenceError = submitted && reference.trim() === ''
        ? 'Enter a reference for this charge.' : undefined;
    const zonesError = submitted && zones === '' ? 'Enter the number of zones.'
        : submitted && parsedZones < 0 ? 'Zones cannot be negative.'
            : undefined;
    const amountError = submitted && amount === '' ? 'Enter an amount.'
        : submitted && parsedAmount < 0 ? 'Amount cannot be negative.'
            : undefined;

    const isFormValid = Boolean(fromCourier && toCourier && client)
        && !sameCourier
        && reference.trim() !== '' && zones !== '' && amount !== ''
        && Number.isFinite(parsedZones) && Number.isFinite(parsedAmount)
        && parsedZones >= 0 && parsedAmount >= 0;

    /** What the ledger will record. A real zero shows as one; only a blank field is unknown. */
    const ledgerAmount = Number.isFinite(parsedAmount) ? parsedAmount : null;

    /* Mantine flags every errored control with aria-invalid, so the first gap can
       be found without threading a ref through each field. */
    useEffect(() => {
        if (submitAttempt === 0) return;
        document
            .querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')
            ?.focus();
    }, [submitAttempt]);

    const resetAmountToZoneRate = useCallback(() => {
        if (zoneRateAmount !== null) setAmount(String(zoneRateAmount));
    }, [zoneRateAmount]);

    const handleSubmit = useCallback(async () => {
        setSubmitted(true);

        if (!isFormValid) {
            setSubmitAttempt(attempt => attempt + 1);
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

            showToast('Charge added', 'success');
            onClose();
        } catch (error) {
            showToast("Couldn't add the charge. Try again.", 'error');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }, [isFormValid, fromCourier, toCourier, client, reference, amount, showToast, onClose]);

    const handleClose = useCallback(() => {
        if (!isSubmitting) onClose();
    }, [isSubmitting, onClose]);

    const zoneRateHint = useMemo(() => `${formatCurrency(ZONE_RATE)} a zone`, []);

    /* The two rows are one named group, so the visible label doubles as the
       ledger's accessible name rather than being repeated in an aria-label. */
    const ledgerLabelId = useId();

    return (
        <DialogShell opened={open} onClose={handleClose} label="Inter-Courier Charge">
            <DialogHeader
                icon={<Icon lucide={Banknote} />}
                title="Inter-Courier Charge"
                subtitle="Charge one courier and credit another"
                onClose={handleClose}
                closeDisabled={isSubmitting}
            />
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Stack gap="lg">
                    <Box>
                        <Text {...sectionLabelProps}>Couriers</Text>
                        <Paper {...sectionPaperProps}>
                            <Stack gap="md">
                                <SearchSelect<Suggestion>
                                    label="From Courier"
                                    placeholder="Search Courier..."
                                    value={fromCourier}
                                    onChange={setFromCourier}
                                    search={searchActiveCouriers}
                                    getOptionKey={suggestionKey}
                                    getOptionLabel={suggestionLabel}
                                    error={fromCourierError}
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
                                    error={toCourierError}
                                    withAsterisk
                                />
                            </Stack>
                        </Paper>
                    </Box>

                    <Box>
                        <Text {...sectionLabelProps}>Charge</Text>
                        <Paper {...sectionPaperProps}>
                            <Stack gap="md">
                                <SearchSelect<Suggestion>
                                    label="Client"
                                    placeholder="Search Client..."
                                    value={client}
                                    onChange={setClient}
                                    search={searchActiveClients}
                                    getOptionKey={suggestionKey}
                                    getOptionLabel={suggestionLabel}
                                    error={clientError}
                                    withAsterisk
                                />
                                <TextInput
                                    label="Reference"
                                    placeholder="Enter reference"
                                    withAsterisk
                                    maxLength={REFERENCE_MAX}
                                    value={reference}
                                    onChange={(e) => setReference(e.currentTarget.value)}
                                    error={referenceError}
                                />
                                <Group gap="md" align="flex-start" grow>
                                    <NumberInput
                                        label="Zones"
                                        description={zoneRateHint}
                                        /* Hint under the input, not under the label, so Zones and
                                           Amount start at the same line. */
                                        inputWrapperOrder={['label', 'input', 'description', 'error']}
                                        withAsterisk
                                        min={0}
                                        value={zones}
                                        onChange={(value) => handleZonesChange(String(value ?? ''))}
                                        error={zonesError}
                                    />
                                    <Box>
                                        <NumberInput
                                            label="Amount"
                                            withAsterisk
                                            min={0}
                                            step={0.01}
                                            value={amount}
                                            onChange={(value) => setAmount(String(value ?? ''))}
                                            error={amountError}
                                        />
                                        {isOverridden && (
                                            <Group gap={8} mt={6} wrap="nowrap">
                                                <Badge size="xs" variant="light" color="orange">Overridden</Badge>
                                                <Anchor
                                                    component="button"
                                                    type="button"
                                                    fz="xs"
                                                    onClick={resetAmountToZoneRate}
                                                >
                                                    Reset to {formatCurrency(zoneRateAmount!)}
                                                </Anchor>
                                            </Group>
                                        )}
                                    </Box>
                                </Group>
                            </Stack>
                        </Paper>
                    </Box>

                    <Box>
                        <Text {...sectionLabelProps} id={ledgerLabelId}>What gets recorded</Text>
                        <Paper
                            withBorder
                            radius="md"
                            bg="var(--mantine-color-white)"
                            role="group"
                            aria-labelledby={ledgerLabelId}
                        >
                            <LedgerRow
                                eyebrow="Charged"
                                courier={fromCourier}
                                amount={ledgerAmount}
                                sign={MINUS}
                                color="red.7"
                            />
                            <Divider/>
                            <LedgerRow
                                eyebrow="Credited"
                                courier={toCourier}
                                amount={ledgerAmount}
                                sign="+"
                                color="green.7"
                            />
                        </Paper>
                    </Box>
                </Stack>
            </Box>
            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleSubmit}
                confirmLabel="Add Charge"
                confirmIcon={<Icon lucide={Plus} size={16} />}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default InterCourierChargeDialog;
