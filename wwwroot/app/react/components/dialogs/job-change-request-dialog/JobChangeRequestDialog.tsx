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
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import SendIcon from '@mui/icons-material/Send';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import {DialogShell, DialogHeader, DialogFooter} from '../shared';
import {jobChangeRequestApi, type JobChangeRequestResult} from '../../../services/jobChangeRequestApi';
import {getSpeedList} from '../../../services/jobDetailApi';
import {toastService} from '../../../services/toastService';
import {FIELD_META, formatChangeRequestValue, getFieldMeta, type JobChangeRequestFieldMeta} from '../../job-change-requests/jobChangeRequestFormatting';
import type {ISuggestion} from '../../../../interfaces/job.interface';

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
        <DialogShell open={open} onClose={handleClose} disableEnforceFocus>
            <DialogHeader
                icon={<SyncAltIcon/>}
                title={lockedField ? `Confirm ${meta.label} change` : `Request change to ${meta.label}`}
                subtitle={`Job ${jobNo} · ${subtitle}`}
                onClose={handleClose}
            />
            {/* Content */}
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box
                    sx={{
                        p: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        // Surface the form controls against the muted content
                        // background — matches SelectDialog / EditDateTimeDialog.
                        '& .MuiOutlinedInput-root': {bgcolor: 'background.paper'},
                    }}
                >
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

                    <TextField
                        label={lockedField ? 'Reason' : 'Reason (optional)'}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={5}
                        autoFocus={lockedField}
                        helperText={`Visible to ${partnerLabel} during approval`}
                    />

                    {meta.commercial && (
                        <Alert severity="info" variant="outlined" sx={{py: 0.5}}>
                            This change re-rates the job. {partnerName?.trim() ? partnerName.trim() : 'The partner'} will see the new price when they approve.
                        </Alert>
                    )}

                    {error && <Alert severity="error">{error}</Alert>}
                </Box>
            </DialogContent>
            {/* Actions */}
            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleSubmit}
                confirmLabel={meta.mode === 'auto' ? 'Apply' : 'Submit'}
                confirmIcon={<SendIcon/>}
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
function LockedFieldSummary({fieldName, meta, value}: LockedFieldSummaryProps) {
    const displayValue = formatChangeRequestValue(fieldName, value) || '—';
    return (
        <Box
            sx={theme => ({
                px: 2,
                py: 1.5,
                borderRadius: 1,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: 'action.hover',
            })}
        >
            <Typography
                variant="overline"
                sx={{
                    color: "text.secondary",
                    letterSpacing: 1,
                    lineHeight: 1
                }}>
                Field
            </Typography>
            <Typography variant="body2" sx={{mb: 1, mt: 0.25}}>
                <Box component="span" sx={{display: 'inline-block', minWidth: 20, textAlign: 'center', mr: 1}}>
                    {meta.glyph}
                </Box>
                {meta.label}
            </Typography>
            <Typography
                variant="overline"
                sx={{
                    color: "text.secondary",
                    letterSpacing: 1,
                    lineHeight: 1
                }}>
                New value
            </Typography>
            <Typography
                variant="body2"
                sx={{mt: 0.25, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}
            >
                {displayValue}
            </Typography>
            <Typography
                variant="caption"
                sx={{
                    color: "text.secondary",
                    display: 'block',
                    mt: 1
                }}>
                {meta.hint}
            </Typography>
        </Box>
    );
}

interface FieldPickerProps {
    value: string;
    onChange: (value: string) => void;
    meta: JobChangeRequestFieldMeta;
}

function FieldPicker({value, onChange, meta}: FieldPickerProps) {
    const grouped = useMemo(() => {
        const autos: Array<[string, JobChangeRequestFieldMeta]> = [];
        const manuals: Array<[string, JobChangeRequestFieldMeta]> = [];
        for (const key of SELECTABLE_FIELDS) {
            const m = FIELD_META[key];
            if (!m) continue;
            (m.mode === 'auto' ? autos : manuals).push([key, m]);
        }
        return {autos, manuals};
    }, []);

    return (
        <TextField
            select
            label="Field"
            value={value}
            onChange={e => onChange(e.target.value)}
            size="small"
            fullWidth
            helperText={meta.hint}
        >
            <ListHeader>Applies immediately</ListHeader>
            {grouped.autos.map(([key, m]) => (
                <MenuItem key={key} value={key}>
                    <Box component="span" sx={{display: 'inline-block', minWidth: 20, textAlign: 'center', mr: 1}}>{m.glyph}</Box>
                    {m.label}
                </MenuItem>
            ))}
            <Divider component="li"/>
            <ListHeader>Requires partner approval</ListHeader>
            {grouped.manuals.map(([key, m]) => (
                <MenuItem key={key} value={key}>
                    <Box component="span" sx={{display: 'inline-block', minWidth: 20, textAlign: 'center', mr: 1}}>{m.glyph}</Box>
                    {m.label}
                    {m.commercial && (
                        <Box component="span" sx={{ml: 'auto', fontSize: '0.7rem', color: 'warning.main', pl: 2}}>
                            re-rates
                        </Box>
                    )}
                </MenuItem>
            ))}
        </TextField>
    );
}

/**
 * Non-interactive header inside a select dropdown. MUI's MenuItem is the
 * right primitive (gets the correct typography + spacing) but it needs
 * `disabled` so the keyboard / mouse skip past it on selection. We render
 * it as muted overline text to read as a section heading.
 */
function ListHeader({children}: {children: React.ReactNode}) {
    return (
        <MenuItem
            disabled
            sx={{
                opacity: '1 !important',
                py: 0.25,
                cursor: 'default',
                '&.Mui-disabled': {opacity: 1},
            }}
        >
            <Typography
                variant="overline"
                sx={{
                    color: "text.secondary",
                    letterSpacing: 1,
                    fontSize: '0.65rem'
                }}>
                {children}
            </Typography>
        </MenuItem>
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
            return (
                <TextField
                    label="Service speed"
                    value="Loading…"
                    size="small"
                    fullWidth
                    disabled
                />
            );
        }
        return (
            <TextField
                select
                label="Service speed"
                value={textValue}
                onChange={e => onTextChange(e.target.value)}
                size="small"
                fullWidth
            >
                {speedList.length === 0 && (
                    <MenuItem value="" disabled>No speeds available</MenuItem>
                )}
                {speedList.map(s => (
                    <MenuItem key={s.id} value={String(s.id)}>{s.text}</MenuItem>
                ))}
            </TextField>
        );
    }
    if (fieldName === 'PartnerAgreedRate') {
        return (
            <TextField
                label="Agreed rate"
                value={textValue}
                onChange={e => onTextChange(e.target.value)}
                size="small"
                fullWidth
                type="number"
                slotProps={{
                    input: {
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        inputProps: {step: '0.01', min: '0'},
                    },
                }}
            />
        );
    }
    if (fieldName === 'Quantity') {
        return (
            <TextField
                label="Quantity"
                value={textValue}
                onChange={e => onTextChange(e.target.value)}
                size="small"
                fullWidth
                type="number"
                slotProps={{input: {inputProps: {step: '1', min: '1'}}}}
            />
        );
    }
    if (meta.category === 'datetime') {
        // Native datetime-local keeps the bundle slim. Picks up the user's
        // locale formatting and supports keyboard input.
        return (
            <TextField
                label={meta.label}
                value={textValue}
                onChange={e => onTextChange(e.target.value)}
                size="small"
                fullWidth
                type="datetime-local"
                slotProps={{inputLabel: {shrink: true}}}
            />
        );
    }
    return (
        <TextField
            label={`New ${meta.label.toLowerCase()}`}
            value={textValue}
            onChange={e => onTextChange(e.target.value)}
            size="small"
            fullWidth
            multiline={meta.category === 'note'}
            minRows={meta.category === 'note' ? 3 : 1}
            maxRows={meta.category === 'note' ? 8 : 1}
        />
    );
}

interface AddressFieldGroupProps {
    value: AddressDraft;
    onChange: (value: AddressDraft) => void;
}

function AddressFieldGroup({value, onChange}: AddressFieldGroupProps) {
    const set = (key: keyof AddressDraft) => (event: React.ChangeEvent<HTMLInputElement>) =>
        onChange({...value, [key]: event.target.value});
    return (
        <Stack spacing={1}>
            <TextField
                label="Address line 1"
                value={value.addressLine1}
                onChange={set('addressLine1')}
                size="small"
                fullWidth
                autoFocus
            />
            <TextField
                label="Address line 2"
                value={value.addressLine2}
                onChange={set('addressLine2')}
                size="small"
                fullWidth
            />
            <Stack direction="row" spacing={1}>
                <TextField
                    label="Suburb"
                    value={value.addressLine3}
                    onChange={set('addressLine3')}
                    size="small"
                    fullWidth
                />
                <TextField
                    label="City"
                    value={value.addressLine4}
                    onChange={set('addressLine4')}
                    size="small"
                    fullWidth
                />
            </Stack>
            <Stack direction="row" spacing={1}>
                <TextField
                    label="State"
                    value={value.addressLine5}
                    onChange={set('addressLine5')}
                    size="small"
                    fullWidth
                />
                <TextField
                    label="Postcode"
                    value={value.addressLine6}
                    onChange={set('addressLine6')}
                    size="small"
                    fullWidth
                />
                <TextField
                    label="Country"
                    value={value.addressLine7}
                    onChange={set('addressLine7')}
                    size="small"
                    fullWidth
                />
            </Stack>
        </Stack>
    );
}
