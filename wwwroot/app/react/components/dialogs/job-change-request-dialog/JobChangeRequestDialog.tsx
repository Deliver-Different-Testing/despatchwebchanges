/**
 * Job Change Request Dialog
 *
 * Lets a dispatcher submit a change request against an inter-tenant partner job.
 * Auto-apply fields (Notes / ProgressNote / PodNote / references / tracking)
 * apply immediately on the local job; manual fields open a task on the
 * partner's dashboard and await approval.
 *
 * Each field gets a typed input matched to its semantic — currency for the
 * agreed rate, integer stepper for quantity, the live speed list for
 * service speed, native datetime for dates, structured fields for
 * pickup/delivery address — so the dialog can't silently file a malformed
 * request. The title, helper hint, and dropdown glyphs all come from the
 * shared formatter so labels match the history panel and approver inbox.
 */

import React, {useState, useCallback, useEffect, useMemo, useRef} from 'react';
import {Alert, Box, Group, NumberInput, Paper, Select, Stack, Text, TextInput, Textarea} from '@mantine/core';
import {ArrowLeftRight, CircleX, Info, Send} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg} from '../shared/mantine';
import {jobChangeRequestApi} from '../../../services/jobChangeRequestApi';
import {getSpeedList} from '../../../services/jobDetailApi';
import {toastService} from '../../../services/toastService';
import {FIELD_META, formatChangeRequestValue, getFieldMeta, type JobChangeRequestFieldMeta} from '../../job-change-requests/jobChangeRequestFormatting';
import type {ISuggestion} from '../../../../interfaces/job.interface';
import type {JobChangeRequestResult} from '../../../interfaces/jobChangeRequest';

/**
 * The dialog supports a subset of FIELD_META — the fields a dispatcher
 * realistically requests from a partner. Auto-apply notes are included
 * because some workflows file them explicitly (e.g. attaching a context
 * note before requesting a manual change in the same session).
 */
const SELECTABLE_FIELDS: string[] = [
    'Notes', 'ProgressNote', 'PodNote',
    'PartnerAgreedRate', 'Quantity', 'Speed',
    'FromContactName', 'FromContactPhone', 'ToContactName', 'ToContactPhone',
    'PickupAddress', 'DeliveryAddress',
    'Date', 'PuTime', 'DeliverBy',
];

export interface JobChangeRequestDialogProps {
    open: boolean;
    jobId: number;
    jobNo: string;
    onClose: () => void;
    onSubmitted?: (result: JobChangeRequestResult) => void;
    /** Field to preselect when the dialog opens. Must match a JobChangeField enum value. */
    preselectedFieldName?: string;
    /** Value to pre-fill in the requested-value input when the dialog opens. */
    preInitialValue?: string;
    /**
     * When true, the dialog is the second leg of a "main edit dialog → confirm"
     * flow: the user already chose the field and entered the new value via the
     * regular edit dialog, so the picker and value input are rendered as a
     * read-only summary and only the reason textarea is editable.
     */
    lockedField?: boolean;
    /**
     * Name of the OTHER tenant on the partner pairing. When provided, copy
     * substitutes the tenant name for the generic "partner" wording so the
     * dispatcher sees exactly who will approve their change request.
     */
    partnerName?: string | null;
    /**
     * IntMgrPartnerPairing.Id the job belongs to. Forwarded to the backend so
     * the change-request resolver doesn't have to guess on tenants with more
     * than one active pairing.
     */
    pairingId?: number | null;
}

interface AddressDraft {
    addressLine1: string;
    addressLine2: string;
    addressLine3: string;
    addressLine4: string;
    addressLine5: string;
    addressLine6: string;
    addressLine7: string;
    addressLine8: string;
    fullAddress: string;
}

const EMPTY_ADDRESS: AddressDraft = {
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    addressLine4: '',
    addressLine5: '',
    addressLine6: '',
    addressLine7: '',
    addressLine8: '',
    fullAddress: '',
};

function parseAddressDraft(value: string): AddressDraft {
    if (!value) return EMPTY_ADDRESS;
    try {
        const parsed = JSON.parse(value) as Partial<AddressDraft>;
        return {...EMPTY_ADDRESS, ...parsed};
    } catch {
        return {...EMPTY_ADDRESS, fullAddress: value};
    }
}

function serialiseAddressDraft(draft: AddressDraft): string {
    const fullAddress = draft.fullAddress.trim() || joinAddressLines(draft);
    return JSON.stringify({...draft, fullAddress});
}

function joinAddressLines(draft: AddressDraft): string {
    return [
        draft.addressLine1, draft.addressLine2, draft.addressLine3, draft.addressLine4,
        draft.addressLine5, draft.addressLine6, draft.addressLine7, draft.addressLine8,
    ].filter(s => s.trim()).join(' · ');
}

function isAddressDraftEmpty(draft: AddressDraft): boolean {
    return !joinAddressLines(draft) && !draft.fullAddress.trim();
}

export const JobChangeRequestDialog: React.FC<JobChangeRequestDialogProps> = ({
    open,
    jobId,
    jobNo,
    onClose,
    onSubmitted,
    preselectedFieldName,
    preInitialValue,
    lockedField = false,
    partnerName,
    pairingId,
}) => {
    const partnerLabel = partnerName?.trim() || 'the partner';
    const [fieldName, setFieldName] = useState(preselectedFieldName ?? 'Notes');
    const [requestedValue, setRequestedValue] = useState(preInitialValue ?? '');
    const [addressDraft, setAddressDraft] = useState<AddressDraft>(() => parseAddressDraft(preInitialValue ?? ''));
    const [reason, setReason] = useState('');
    // Validation-only error surfaced inline. Post-submit errors (network /
    // backend failures) are shown via a toast because the dialog is closed
    // synchronously once validation passes so the dispatcher isn't blocked
    // while the request travels through the partner relay.
    const [error, setError] = useState('');
    const [speedList, setSpeedList] = useState<ISuggestion[] | null>(null);

    const meta = useMemo(() => getFieldMeta(fieldName), [fieldName]);

    // Re-prime form state when the dialog transitions from closed → open so
    // reopening with different preselected props reflects the new intent
    // instead of reusing stale state from the previous open.
    const wasOpenRef = useRef(open);
    useEffect(() => {
        if (open && !wasOpenRef.current) {
            setFieldName(preselectedFieldName ?? 'Notes');
            setRequestedValue(preInitialValue ?? '');
            setAddressDraft(parseAddressDraft(preInitialValue ?? ''));
            setReason('');
            setError('');
        }
        wasOpenRef.current = open;
    }, [open, preselectedFieldName, preInitialValue]);

    // Lazy-load the speed list the first time the user picks Speed. Cached
    // per dialog mount so flipping back and forth doesn't refetch.
    useEffect(() => {
        if (fieldName === 'Speed' && speedList === null) {
            void getSpeedList()
                .then(setSpeedList)
                .catch(() => setSpeedList([])); // fall back to free text on failure
        }
    }, [fieldName, speedList]);

    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    const submitValue = useMemo(() => {
        switch (meta.category) {
            case 'address':
                return isAddressDraftEmpty(addressDraft) ? '' : serialiseAddressDraft(addressDraft);
            default:
                return requestedValue.trim();
        }
    }, [meta.category, addressDraft, requestedValue]);

    const handleSubmit = useCallback(() => {
        if (!fieldName) {
            setError('Choose a field to change');
            return;
        }
        if (!submitValue) {
            setError(meta.category === 'address'
                ? 'Enter at least one address line'
                : 'Enter the requested value');
            return;
        }
        // Validation passed — close the dialog immediately and report progress
        // via a sticky toast so the dispatcher isn't blocked while the request
        // travels through IM to the partner tenant.
        const isAutoApply = meta.mode === 'auto';
        const fieldLabel = meta.label;
        const trimmedReason = reason.trim() || undefined;
        const targetFieldName = fieldName;
        const targetValue = submitValue;
        onClose();
        const toast = toastService.showLoadingToast(
            isAutoApply
                ? `Applying ${fieldLabel} change…`
                : `Sending ${fieldLabel} change to ${partnerLabel}…`,
        );
        jobChangeRequestApi.create({
            jobId,
            fieldName: targetFieldName,
            requestedValue: targetValue,
            reason: trimmedReason,
            pairingId: pairingId ?? undefined,
        }).then((result) => {
            if (!result.success) {
                toast.update(result.message ?? 'Submission failed', 'error');
                return;
            }
            if (result.peerForwardWarning) {
                toast.update(
                    `Saved locally, but ${partnerLabel} was not notified (${result.peerForwardWarning}). Please retry or contact support.`,
                    'warning',
                );
            } else {
                toast.update(
                    result.request?.status === 'Applied'
                        ? 'Change applied'
                        : `Change request sent to ${partnerLabel}`,
                    'success',
                );
            }
            onSubmitted?.(result);
        }).catch((e: unknown) => {
            const msg = (e as { message?: string })?.message ?? 'Submission failed';
            toast.update(msg, 'error');
        });
    }, [fieldName, submitValue, meta.category, meta.mode, meta.label, reason, jobId, partnerLabel, pairingId, onClose, onSubmitted]);

    // Short instructional subtitle that mirrors the pattern used by sibling
    // dialogs (SelectDialog: "Select an option…", EditDateTimeDialog: "Update
    // the date and time"). Switches based on whether the field auto-applies,
    // requires partner approval, or is just collecting the reason.
    const subtitle = lockedField
        ? `Add a reason for ${partnerLabel}`
        : meta.mode === 'auto'
            ? 'Applies immediately to both sides'
            : `Requires ${partnerLabel} to approve before it applies`;

    return (
        <DialogShell opened={open} onClose={handleClose} label={`Request change to ${meta.label}`} trapFocus={false}>
            <DialogHeader
                icon={<Icon lucide={ArrowLeftRight}/>}
                title={lockedField ? `Confirm ${meta.label} change` : `Request change to ${meta.label}`}
                subtitle={`Job ${jobNo} · ${subtitle}`}
                onClose={handleClose}
            />
            {/* Content */}
            <Box p="lg" bg={dialogContentBg}>
                <Stack gap="md">
                    {lockedField ? (
                        <LockedFieldSummary
                            fieldName={fieldName}
                            meta={meta}
                            value={submitValue}
                        />
                    ) : (
                        <>
                            <FieldPicker
                                value={fieldName}
                                onChange={value => {
                                    setFieldName(value);
                                    setRequestedValue('');
                                    setAddressDraft(EMPTY_ADDRESS);
                                }}
                                meta={meta}
                            />

                            <FieldValueInput
                                fieldName={fieldName}
                                meta={meta}
                                textValue={requestedValue}
                                onTextChange={setRequestedValue}
                                addressValue={addressDraft}
                                onAddressChange={setAddressDraft}
                                speedList={speedList}
                            />
                        </>
                    )}

                    <Textarea
                        label={lockedField ? 'Reason' : 'Reason (optional)'}
                        value={reason}
                        onChange={e => setReason(e.currentTarget.value)}
                        minRows={2}
                        maxRows={5}
                        autosize
                        data-autofocus={lockedField || undefined}
                        description={`Visible to ${partnerLabel} during approval`}
                    />

                    {meta.commercial && (
                        <Alert color="reflex" variant="outline" icon={<Icon lucide={Info} size={18}/>} py={4}>
                            This change re-rates the job. {partnerName?.trim() ? partnerName.trim() : 'The partner'} will see the new price when they approve.
                        </Alert>
                    )}

                    {error && (
                        <Alert color="red" variant="light" icon={<Icon lucide={CircleX} size={18}/>}>
                            {error}
                        </Alert>
                    )}
                </Stack>
            </Box>
            {/* Actions */}
            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleSubmit}
                confirmLabel={meta.mode === 'auto' ? 'Apply' : 'Submit'}
                confirmIcon={<Icon lucide={Send} size={16}/>}
            />
        </DialogShell>
    );
};

// ── Sub-components ───────────────────────────────────────────────────

interface LockedFieldSummaryProps {
    fieldName: string;
    meta: JobChangeRequestFieldMeta;
    value: string;
}

/**
 * Read-only summary card rendered when the dialog is the second leg of an
 * "edit then confirm" flow — the user already entered the new value via the
 * main edit dialog, so we display the chosen field + value as a static
 * summary instead of an editable picker / input pair. The only thing they
 * still control is the reason textarea below this block.
 */
/** The quiet caption above each value in the summary. */
const overlineProps = {size: 'xs', c: 'dimmed', tt: 'uppercase', lh: 1} as const;

/** Fixed gutter so the glyph and label line up between the picker and the summary. */
const glyphStyle: React.CSSProperties = {
    display: 'inline-block',
    minWidth: 20,
    textAlign: 'center',
    marginRight: 8,
};

function LockedFieldSummary({fieldName, meta, value}: LockedFieldSummaryProps) {
    const displayValue = formatChangeRequestValue(fieldName, value) || '—';
    return (
        <Paper withBorder radius="xs" px="md" py="sm" bg="var(--mantine-color-gray-1)">
            <Text {...overlineProps} style={{letterSpacing: 1}}>Field</Text>
            <Text size="sm" mb="xs" mt={2}>
                <Box component="span" style={glyphStyle}>{meta.glyph}</Box>
                {meta.label}
            </Text>
            <Text {...overlineProps} style={{letterSpacing: 1}}>New value</Text>
            <Text size="sm" mt={2} style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                {displayValue}
            </Text>
            <Text size="xs" c="dimmed" mt="xs">{meta.hint}</Text>
        </Paper>
    );
}

interface FieldPickerProps {
    value: string;
    onChange: (value: string) => void;
    meta: JobChangeRequestFieldMeta;
}

function FieldPicker({value, onChange, meta}: FieldPickerProps) {
    /**
     * Mantine `Select` groups natively, which replaces the hand-rolled disabled
     * "list header" MenuItems and the divider between them.
     */
    const data = useMemo(() => {
        const autos: Array<{value: string; label: string}> = [];
        const manuals: Array<{value: string; label: string}> = [];
        for (const key of SELECTABLE_FIELDS) {
            const m = FIELD_META[key];
            if (!m) continue;
            (m.mode === 'auto' ? autos : manuals).push({value: key, label: m.label});
        }
        return [
            {group: 'Applies immediately', items: autos},
            {group: 'Requires partner approval', items: manuals},
        ];
    }, []);

    return (
        <Select
            label="Field"
            value={value}
            onChange={next => next && onChange(next)}
            data={data}
            allowDeselect={false}
            description={meta.hint}
            comboboxProps={{keepMounted: false}}
            renderOption={({option}) => {
                const m = FIELD_META[option.value];
                return (
                    <Group gap={0} wrap="nowrap" style={{flex: 1}}>
                        <Box component="span" style={glyphStyle}>{m?.glyph}</Box>
                        <span>{option.label}</span>
                        {m?.commercial && (
                            <Text component="span" size="xs" c="orange" ml="auto" pl="md">re-rates</Text>
                        )}
                    </Group>
                );
            }}
        />
    );
}

interface FieldValueInputProps {
    fieldName: string;
    meta: JobChangeRequestFieldMeta;
    textValue: string;
    onTextChange: (value: string) => void;
    addressValue: AddressDraft;
    onAddressChange: (value: AddressDraft) => void;
    speedList: ISuggestion[] | null;
}

function FieldValueInput({
    fieldName, meta, textValue, onTextChange, addressValue, onAddressChange, speedList,
}: FieldValueInputProps) {
    if (meta.category === 'address') {
        return <AddressFieldGroup value={addressValue} onChange={onAddressChange}/>;
    }
    if (fieldName === 'Speed') {
        if (speedList === null) {
            return <TextInput label="Service speed" value="Loading…" disabled/>;
        }
        return (
            <Select
                label="Service speed"
                value={textValue || null}
                onChange={next => onTextChange(next ?? '')}
                data={speedList.map(s => ({value: String(s.id), label: s.text ?? ''}))}
                nothingFoundMessage="No speeds available"
                comboboxProps={{keepMounted: false}}
            />
        );
    }
    if (fieldName === 'PartnerAgreedRate') {
        // The currency marker goes in `leftSection`, never `prefix` — Mantine's
        // prefix becomes part of the value and would ship "$185.50" on the wire.
        return (
            <NumberInput
                label="Agreed rate"
                value={textValue}
                onChange={value => onTextChange(String(value ?? ''))}
                decimalScale={2}
                step={0.01}
                min={0}
                leftSection="$"
            />
        );
    }
    if (fieldName === 'Quantity') {
        return (
            <NumberInput
                label="Quantity"
                value={textValue}
                onChange={value => onTextChange(String(value ?? ''))}
                allowDecimal={false}
                step={1}
                min={1}
            />
        );
    }
    if (meta.category === 'datetime') {
        // Native datetime-local keeps the bundle slim. Picks up the user's
        // locale formatting and supports keyboard input.
        return (
            <TextInput
                label={meta.label}
                value={textValue}
                onChange={e => onTextChange(e.currentTarget.value)}
                type="datetime-local"
            />
        );
    }
    if (meta.category === 'note') {
        return (
            <Textarea
                label={`New ${meta.label.toLowerCase()}`}
                value={textValue}
                onChange={e => onTextChange(e.currentTarget.value)}
                minRows={3}
                maxRows={8}
                autosize
            />
        );
    }
    return (
        <TextInput
            label={`New ${meta.label.toLowerCase()}`}
            value={textValue}
            onChange={e => onTextChange(e.currentTarget.value)}
        />
    );
}

interface AddressFieldGroupProps {
    value: AddressDraft;
    onChange: (value: AddressDraft) => void;
}

function AddressFieldGroup({value, onChange}: AddressFieldGroupProps) {
    const set = (key: keyof AddressDraft) => (event: React.ChangeEvent<HTMLInputElement>) =>
        onChange({...value, [key]: event.currentTarget.value});
    return (
        <Stack gap="xs">
            <TextInput
                label="Address line 1"
                value={value.addressLine1}
                onChange={set('addressLine1')}
                data-autofocus
            />
            <TextInput
                label="Address line 2"
                value={value.addressLine2}
                onChange={set('addressLine2')}
            />
            <Group gap="xs" grow align="flex-start">
                <TextInput label="Suburb" value={value.addressLine3} onChange={set('addressLine3')}/>
                <TextInput label="City" value={value.addressLine4} onChange={set('addressLine4')}/>
            </Group>
            <Group gap="xs" grow align="flex-start">
                <TextInput label="State" value={value.addressLine5} onChange={set('addressLine5')}/>
                <TextInput label="Postcode" value={value.addressLine6} onChange={set('addressLine6')}/>
                <TextInput label="Country" value={value.addressLine7} onChange={set('addressLine7')}/>
            </Group>
        </Stack>
    );
}
