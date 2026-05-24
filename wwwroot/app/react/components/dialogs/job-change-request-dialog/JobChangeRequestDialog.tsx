/**
 * Job Change Request Dialog
 *
 * Lets a dispatcher submit a change request against an inter-tenant partner job.
 * Auto-apply fields (Notes / ProgressNote / PodNote / references / tracking)
 * apply immediately on the local job; manual fields open a task on the
 * counterparty's dashboard and await approval.
 *
 * Each field gets a typed input matched to its semantic — currency for the
 * agreed rate, integer stepper for quantity, the live speed list for
 * service speed, native datetime for dates, structured fields for
 * pickup/delivery address — so the dialog can't silently file a malformed
 * request. The title, helper hint, and dropdown glyphs all come from the
 * shared formatter so labels match the history panel and approver inbox.
 */

import React, {useState, useCallback, useEffect, useMemo, useRef} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import {jobChangeRequestApi, type JobChangeRequestResult} from '../../../services/jobChangeRequestApi';
import {getSpeedList} from '../../../services/jobDetailApi';
import {FIELD_META, getFieldMeta, type JobChangeRequestFieldMeta} from '../../job-change-requests/jobChangeRequestFormatting';
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
}) => {
    const [fieldName, setFieldName] = useState(preselectedFieldName ?? 'Notes');
    const [requestedValue, setRequestedValue] = useState(preInitialValue ?? '');
    const [addressDraft, setAddressDraft] = useState<AddressDraft>(() => parseAddressDraft(preInitialValue ?? ''));
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
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
            setSuccess('');
            setSubmitting(false);
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
        if (submitting) return;
        onClose();
    }, [submitting, onClose]);

    const submitValue = useMemo(() => {
        switch (meta.category) {
            case 'address':
                return isAddressDraftEmpty(addressDraft) ? '' : serialiseAddressDraft(addressDraft);
            default:
                return requestedValue.trim();
        }
    }, [meta.category, addressDraft, requestedValue]);

    const handleSubmit = useCallback(async () => {
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
        setError('');
        setSuccess('');
        setSubmitting(true);
        try {
            const result = await jobChangeRequestApi.create({
                jobId,
                fieldName,
                requestedValue: submitValue,
                reason: reason.trim() || undefined,
            });
            if (!result.success) {
                setError(result.message ?? 'Submission failed');
            } else {
                const status = result.request?.status === 'Applied'
                    ? 'Change applied'
                    : 'Change request sent to partner';
                setSuccess(status);
                onSubmitted?.(result);
            }
        } catch (e) {
            const msg = (e as { message?: string })?.message ?? 'Submission failed';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    }, [fieldName, submitValue, meta.category, reason, jobId, onSubmitted]);

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <Box sx={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', px: 3, pt: 2}}>
                <Box>
                    <Typography variant="overline" color="text.secondary" sx={{letterSpacing: 1}}>
                        Job {jobNo}
                    </Typography>
                    <Typography variant="h6">
                        <Box component="span" sx={{mr: 1}}>{meta.glyph}</Box>
                        Request change to {meta.label}
                    </Typography>
                </Box>
                <IconButton onClick={handleClose} size="small" disabled={submitting}>
                    <CloseIcon/>
                </IconButton>
            </Box>

            <DialogContent>
                <Stack spacing={2}>
                    <FieldPicker
                        value={fieldName}
                        onChange={value => {
                            setFieldName(value);
                            setRequestedValue('');
                            setAddressDraft(EMPTY_ADDRESS);
                        }}
                        disabled={submitting}
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
                        disabled={submitting}
                    />

                    <TextField
                        label="Reason (optional)"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={5}
                        disabled={submitting}
                        helperText="Visible to the counterparty during approval"
                    />

                    {meta.commercial && (
                        <Alert severity="info" variant="outlined" sx={{py: 0.5}}>
                            This change re-rates the job. The counterparty will see the new price when they approve.
                        </Alert>
                    )}

                    {error && <Alert severity="error">{error}</Alert>}
                    {success && <Alert severity="success">{success}</Alert>}
                </Stack>
            </DialogContent>

            <DialogActions sx={{px: 3, pb: 2}}>
                <Button onClick={handleClose} disabled={submitting}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={16}/> : <SendIcon/>}
                >
                    {submitting ? 'Sending…' : meta.mode === 'auto' ? 'Apply' : 'Submit'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// ── Sub-components ───────────────────────────────────────────────────

interface FieldPickerProps {
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
    meta: JobChangeRequestFieldMeta;
}

function FieldPicker({value, onChange, disabled, meta}: FieldPickerProps) {
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
            disabled={disabled}
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
            <Typography variant="overline" color="text.secondary" sx={{letterSpacing: 1, fontSize: '0.65rem'}}>
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
    disabled: boolean;
}

function FieldValueInput({
    fieldName, meta, textValue, onTextChange, addressValue, onAddressChange, speedList, disabled,
}: FieldValueInputProps) {
    if (meta.category === 'address') {
        return <AddressFieldGroup value={addressValue} onChange={onAddressChange} disabled={disabled}/>;
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
                disabled={disabled}
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
                disabled={disabled}
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
                disabled={disabled}
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
                disabled={disabled}
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
            disabled={disabled}
            multiline={meta.category === 'note'}
            minRows={meta.category === 'note' ? 3 : 1}
            maxRows={meta.category === 'note' ? 8 : 1}
        />
    );
}

interface AddressFieldGroupProps {
    value: AddressDraft;
    onChange: (value: AddressDraft) => void;
    disabled: boolean;
}

function AddressFieldGroup({value, onChange, disabled}: AddressFieldGroupProps) {
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
                disabled={disabled}
                autoFocus
            />
            <TextField
                label="Address line 2"
                value={value.addressLine2}
                onChange={set('addressLine2')}
                size="small"
                fullWidth
                disabled={disabled}
            />
            <Stack direction="row" spacing={1}>
                <TextField
                    label="Suburb"
                    value={value.addressLine3}
                    onChange={set('addressLine3')}
                    size="small"
                    fullWidth
                    disabled={disabled}
                />
                <TextField
                    label="City"
                    value={value.addressLine4}
                    onChange={set('addressLine4')}
                    size="small"
                    fullWidth
                    disabled={disabled}
                />
            </Stack>
            <Stack direction="row" spacing={1}>
                <TextField
                    label="State"
                    value={value.addressLine5}
                    onChange={set('addressLine5')}
                    size="small"
                    fullWidth
                    disabled={disabled}
                />
                <TextField
                    label="Postcode"
                    value={value.addressLine6}
                    onChange={set('addressLine6')}
                    size="small"
                    fullWidth
                    disabled={disabled}
                />
                <TextField
                    label="Country"
                    value={value.addressLine7}
                    onChange={set('addressLine7')}
                    size="small"
                    fullWidth
                    disabled={disabled}
                />
            </Stack>
        </Stack>
    );
}
