/**
 * useJobActions - Extracts all job-specific click/edit handlers from JobDetails.
 *
 * Groups dialog integration, field editing, toggle, and recurring-job handlers
 * into a single hook so the root component stays focused on layout and rendering.
 */

import {useState, useCallback, useRef} from 'react';
import type {Dayjs} from 'dayjs';
import type {IJob, IAddressViewModel, UpdatePodDetailsRequest} from '../JobDetails.types';
import {JOB_TYPE_OPTIONS, TRACKING_OPTIONS, NOTIFY_OPTIONS, ACCEPTED_OPTIONS} from '../JobDetails.types';
import {JobProperty} from '../../../../../enums/job-property.enum';
import {DaysOfWeek, DaysOfWeekHelpers} from '../../../../../enums/days-of-week.enum';
import {AddressType} from '../../../../../enums/address-type.enum';
import {useDialogLoader} from './useDialogLoader';
import {formatDateForApi} from '../../../../utils/dateUtils';
import {getPriceBreakdowns} from '../../../../services/pricingBreakdownApi';
import {
    getSpeedList,
    getVehicleSizes,
    getLeaveList,
    getContactList,
    getStatusList,
    getActiveStaff,
    getUndeliverableList,
    getInternalStatusList,
    autocompleteSearch,
    getPodReportUrl,
    getPodSpreadsheetUrl,
    saveRecurringFlight,
} from '../../../../services/jobDetailApi';
import {
    sendToPartner,
} from '../../../../services/jobListApi';
import type {DispatchType} from '../../../dialogs/dispatch-dialog';
import type {ISuggestion} from '../../../../../interfaces/job.interface';
import {toastService} from '../../../../services/toastService';

interface TextDialogState {
    open: boolean;
    title: string;
    label: string;
    initialValue: string;
    field: string;
    okLabel?: string;
    onSubmitExtra?: () => void;
}

/**
 * Partner-job gate. Maps a JobProperty / field key the user is editing locally
 * to the JobChangeField string used by the inter-tenant change-request
 * workflow, plus a serialiser that converts the dialog's chosen value into
 * the string payload the change-request dialog can pre-populate from.
 *
 * When a partner job is detected, the affected save path forwards the
 * captured value to `onRequestPartnerChange` instead of calling `updateField`
 * (or `updateAddress`), so the change is only ever persisted when the
 * counterparty approves the change request — never speculatively on the
 * caller side. Address and datetime fields need extra context (timezone /
 * structured payload), so they handle their own routing inline rather than
 * going through this map.
 */
const PARTNER_GATE_SIMPLE: Record<string, {
    changeRequestField: string;
    serialise: (value: unknown) => string;
}> = {
    [JobProperty.Amount]: {changeRequestField: 'PartnerAgreedRate', serialise: v => String(v ?? '').trim()},
    [JobProperty.SpeedID]: {changeRequestField: 'Speed', serialise: v => String(v ?? '')},
    [JobProperty.Items]: {changeRequestField: 'Quantity', serialise: v => String(v ?? '')},
    [JobProperty.AcceptedJobTypeID]: {changeRequestField: 'AcceptedJobTypeID', serialise: v => String(v ?? '')},
    [JobProperty.DGClass]: {changeRequestField: 'DGClass', serialise: v => String(v ?? '')},
    [JobProperty.Direct]: {changeRequestField: 'Direct', serialise: v => v ? 'true' : 'false'},
    [JobProperty.FromContactName]: {changeRequestField: 'FromContactName', serialise: v => String(v ?? '')},
    [JobProperty.FromContactPhone]: {changeRequestField: 'FromContactPhone', serialise: v => String(v ?? '')},
    [JobProperty.ToContactName]: {changeRequestField: 'ToContactName', serialise: v => String(v ?? '')},
    [JobProperty.ToContactPhone]: {changeRequestField: 'ToContactPhone', serialise: v => String(v ?? '')},
};

/** Datetime fields gated for partner jobs — handled inline so the timezone from the picker survives. */
const PARTNER_GATED_DATETIME_FIELDS = new Set<string>([
    JobProperty.Date,
    JobProperty.PuTime,
    JobProperty.DeliverBy,
    JobProperty.BookedTime,
]);

/** Serialise an AddressViewModel into the JSON payload the change-request dialog expects. */
function serialisePartnerAddress(addr: IAddressViewModel): string {
    return JSON.stringify({
        addressLine1: addr.addressLine1 ?? '',
        addressLine2: addr.addressLine2 ?? '',
        addressLine3: addr.addressLine3 ?? '',
        addressLine4: addr.addressLine4 ?? '',
        addressLine5: addr.addressLine5 ?? '',
        addressLine6: addr.addressLine6 ?? '',
        addressLine7: addr.addressLine7 ?? '',
        addressLine8: addr.addressLine8 ?? '',
        fullAddress: addr.fullAddress ?? '',
    });
}

const emptyTextDialog: TextDialogState = {
    open: false,
    title: '',
    label: '',
    initialValue: '',
    field: '',
};

interface UseJobActionsOptions {
    job: IJob | undefined;
    isRecurringJob: boolean;
    isUsCustomer: boolean;
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    updateField: (args: {job: IJob; field: string; value: unknown; isRecurring: boolean; timezone?: string}) => Promise<unknown>;
    updateAddress: (args: {job: IJob; address: IAddressViewModel; isDelivery: boolean}) => Promise<unknown>;
    updatePod: (data: UpdatePodDetailsRequest) => Promise<unknown>;
    dispatchJob: (args: {job: IJob; courierId: number}) => Promise<unknown>;
    refreshAndNotify: () => Promise<void>;
    invalidateJobLists: () => Promise<void[]>;
    invalidatePhotos: () => Promise<void>;
    checkForRateChange: (job: IJob) => Promise<void>;
    invalidateAllJobDetails: () => Promise<void>;
    relatedJobs: IJob[];
    onStatusChange?: (statusId: number) => void;
    /**
     * Open the inter-tenant change-request dialog for the current partner job.
     * Called from action handlers that know the inline edit will be rejected
     * by the partner-job gate (e.g. Pricing). The field name must match a
     * value in JobChangeRequestDialog.FIELD_OPTIONS — typically one of
     * 'PartnerAgreedRate', 'Quantity', 'Speed'.
     *
     * Pass `locked` when the new value was already captured via the main
     * edit dialog so the change-request dialog renders the field + value as
     * a read-only summary and the user only fills in the reason.
     */
    onRequestPartnerChange?: (field: string, initialValue?: string, locked?: boolean) => void;
}

export function useJobActions({
    job,
    isRecurringJob,
    isUsCustomer,
    showToast,
    updateField,
    updateAddress,
    updatePod,
    dispatchJob,
    refreshAndNotify,
    invalidateJobLists,
    invalidatePhotos,
    checkForRateChange,
    invalidateAllJobDetails,
    relatedJobs,
    onStatusChange,
    onRequestPartnerChange,
}: UseJobActionsOptions) {
    const {
        ensureSelectDialog,
        ensureDateTimeDialog,
        ensureAutoCompleteDialog,
        ensureAddressDialog,
        ensureVoidDialog,
        ensurePriceBreakdownDialog,
        ensureSimplePriceEditDialog,
        ensureParcelDimensionsDialog,
        ensureSendPodDialog,
        ensureJobFileUploadDialog,
    } = useDialogLoader();

    // Universal dispatch dialog state. JobDetails renders the dialog inline and
    // wires its callbacks back through `dispatchDialogConfirmCourier` /
    // `dispatchDialogConfirmPartner`.
    const [dispatchDialog, setDispatchDialog] = useState<{open: boolean; initialType: DispatchType}>(
        {open: false, initialType: 'Courier'},
    );
    const closeDispatchDialog = useCallback(() => {
        setDispatchDialog((s) => ({...s, open: false}));
    }, []);

    // Saved-flight dialog state (recurring flight bookings only). JobDetails
    // renders the dialog inline and wires `closeSavedFlightDialog` /
    // `savedFlightDialogConfirm` back to the hook.
    const [savedFlightDialog, setSavedFlightDialog] = useState<{
        open: boolean;
        bookingId: number;
        fromAirportId?: number;
        toAirportId?: number;
        currentValue?: string;
        departureDate?: Dayjs;
        showAirportPickers?: boolean;
    }>({open: false, bookingId: 0});
    const closeSavedFlightDialog = useCallback(() => {
        setSavedFlightDialog((s) => ({...s, open: false}));
    }, []);

    // Stable ref for job so callbacks don't recreate on every job change.
    // Assigned synchronously (not via useEffect) so it's never one render behind.
    const jobRef = useRef(job);
    jobRef.current = job;

    // ── Partner-job gating ────────────────────────────────────────
    //
    // Every save path that could mutate a manual-approval field on a partner
    // job funnels through `tryRoutePartnerEdit`. When the job is a partner
    // job AND the field has a change-request mapping, we hand the captured
    // value (already collected via the main edit dialog) to the locked
    // confirmation dialog and bail out before reaching `updateField` /
    // `updateAddress`. Nothing is persisted locally — the value only takes
    // effect after the counterparty approves the change request.

    const tryRoutePartnerEdit = useCallback((field: string, value: unknown): boolean => {
        const j = jobRef.current;
        if (!j?.isPartnerJob || !onRequestPartnerChange) return false;
        const gate = PARTNER_GATE_SIMPLE[field];
        if (!gate) return false;
        onRequestPartnerChange(gate.changeRequestField, gate.serialise(value), true);
        return true;
    }, [onRequestPartnerChange]);

    // ── Text Dialog ────────────────────────────────────────────────

    const [textDialog, setTextDialog] = useState<TextDialogState>(emptyTextDialog);
    const textDialogRef = useRef(textDialog);
    textDialogRef.current = textDialog;

    // Resolve/reject refs for promise-based text dialog (openTextDialogAsync)
    const textDialogResolveRef = useRef<((value: string | null) => void) | null>(null);

    const openTextDialog = useCallback((
        title: string,
        label: string,
        field: string,
        initialValue: string | number | undefined,
        okLabel?: string,
        onSubmitExtra?: () => void,
    ) => {
        setTextDialog({
            open: true,
            title,
            label,
            initialValue: initialValue?.toString() ?? '',
            field,
            okLabel,
            onSubmitExtra,
        });
    }, []);

    /** Promise-based wrapper around the text dialog. Resolves with entered value, or null on cancel. */
    const openTextDialogAsync = useCallback((
        title: string,
        label: string,
        field: string,
        initialValue: string,
        okLabel?: string,
    ): Promise<string | null> => {
        return new Promise((resolve) => {
            textDialogResolveRef.current = resolve;
            setTextDialog({
                open: true,
                title,
                label,
                initialValue,
                field,
                okLabel,
            });
        });
    }, []);

    const handleTextDialogSubmit = useCallback(async (value: string) => {
        const j = jobRef.current;
        if (!j) return;
        const dialog = textDialogRef.current;
        const asyncResolve = textDialogResolveRef.current;
        textDialogResolveRef.current = null;
        setTextDialog(emptyTextDialog);

        if (asyncResolve) {
            // Promise-based flow: resolve with value, caller handles save
            asyncResolve(value);
            return;
        }
        // Partner-job manual fields never persist locally — route the
        // captured value to the locked change-request dialog instead.
        if (tryRoutePartnerEdit(dialog.field, value)) return;
        // State-based flow: save field directly (existing behavior)
        await updateField({job: j, field: dialog.field, value, isRecurring: j.preBook});
        dialog.onSubmitExtra?.();
        await refreshAndNotify();
    }, [updateField, refreshAndNotify, tryRoutePartnerEdit]);

    const handleTextDialogCancel = useCallback(() => {
        const asyncResolve = textDialogResolveRef.current;
        textDialogResolveRef.current = null;
        setTextDialog(emptyTextDialog);
        if (asyncResolve) {
            asyncResolve(null);
        }
    }, []);

    // ── Dialog Primitives ──────────────────────────────────────────

    const editDateAndTime = useCallback(async (field: string, title: string, dateTime?: unknown, timezone?: unknown) => {
        const j = jobRef.current;
        if (!j) return;
        await ensureDateTimeDialog();
        const result = await window.ReactEditDateTimeDialog?.showEditDateAndTimeDialog({
            title,
            fieldName: field,
            dateTime: dateTime as any,
            defaultTimeZone: timezone as any,
        });
        if (!result) return;
        // Partner-job rated datetimes (Date / PuTime / DeliverBy / BookedTime)
        // never persist locally — forward to the locked change-request dialog
        // with the chosen value serialised to an offset-aware ISO string so
        // the counterparty sees the exact moment requested.
        if (j.isPartnerJob && onRequestPartnerChange && PARTNER_GATED_DATETIME_FIELDS.has(result.fieldName)) {
            const serialised = formatDateForApi(result.value as Dayjs, result.timezone);
            onRequestPartnerChange(result.fieldName, serialised, true);
            return;
        }
        if (j.isBulkJob) {
            const {updateBulkJobDetail} = await import('../../../../services/jobDetailApi');
            await updateBulkJobDetail(j.id, result.fieldName, result.value, result.timezone);
        } else {
            const {updateJobDetail} = await import('../../../../services/jobDetailApi');
            await updateJobDetail(j.id, result.fieldName, result.value, j.preBook, result.timezone);
        }
        showToast(`${j.jobNo} updated`, 'success');
        await refreshAndNotify();
    }, [ensureDateTimeDialog, showToast, refreshAndNotify, onRequestPartnerChange]);

    const editDate = useCallback(async (field: string, title: string, dateTime?: unknown, timezone?: unknown) => {
        const j = jobRef.current;
        if (!j) return;
        await ensureDateTimeDialog();
        const result = await window.ReactEditDateTimeDialog?.showEditDateDialog({
            title,
            fieldName: field,
            dateTime: dateTime as any,
            defaultTimeZone: timezone as any,
        });
        if (!result) return;
        // Partner-job rated dates route through the locked change-request
        // dialog instead of persisting locally.
        if (j.isPartnerJob && onRequestPartnerChange && PARTNER_GATED_DATETIME_FIELDS.has(result.fieldName)) {
            const serialised = formatDateForApi(result.value as Dayjs, result.timezone);
            onRequestPartnerChange(result.fieldName, serialised, true);
            return;
        }
        await updateField({job: j, field: result.fieldName, value: result.value, isRecurring: j.preBook, timezone: result.timezone});
        await refreshAndNotify();
    }, [ensureDateTimeDialog, updateField, refreshAndNotify, onRequestPartnerChange]);

    const showSelectDialog = useCallback(async (
        items: Array<{id: number; text: string}>,
        fieldName: string,
        title: string,
        initialValue?: string | number | null,
        showCheckbox?: boolean,
        checkboxLabel?: string,
    ) => {
        const j = jobRef.current;
        if (!j) return;
        await ensureSelectDialog();
        const result = await window.ReactSelectDialog?.showSelectDialog({
            title,
            fieldName,
            items,
            initialValue,
            showCheckbox,
            checkboxLabel,
        });
        if (!result) return;

        // FromContactName writes to PickupFromContact, a free-text column on
        // TucJob — we want the contact's display name, not the lookup id the
        // dropdown surfaces by default. Every other select field routes an
        // id-typed FK column, so the default `result.value` is correct.
        const payload = fieldName === JobProperty.FromContactName ? result.text : result.value;

        // Partner-job manual fields (e.g. Speed, DG Class, Job Type) never
        // persist locally. The DG documentation side-effect drops off here —
        // a follow-up change request would need to be filed separately if
        // the counterparty wants both at once.
        if (tryRoutePartnerEdit(fieldName, payload)) return;

        if (fieldName === JobProperty.DGClass && result.checkboxValue !== undefined) {
            await updateField({job: j, field: fieldName, value: payload, isRecurring: j.preBook});
            if (j.dgDocumentation !== result.checkboxValue) {
                await updateField({job: j, field: JobProperty.DGDocumentation, value: result.checkboxValue, isRecurring: j.preBook});
            }
        } else {
            await updateField({job: j, field: fieldName, value: payload, isRecurring: j.preBook});
        }
        await refreshAndNotify();
    }, [ensureSelectDialog, updateField, refreshAndNotify, tryRoutePartnerEdit]);

    const showAutocompleteDialog = useCallback(async (
        url: string,
        placeholder: string,
        fieldName: string,
        title: string,
        existingItem?: any,
        showRerateOption?: boolean,
    ) => {
        const j = jobRef.current;
        if (!j) return;
        await ensureAutoCompleteDialog();
        const result = await window.ReactAutoCompleteDialog?.open(
            title,
            placeholder,
            (searchTerm: string) => autocompleteSearch(searchTerm, url),
            existingItem,
            showRerateOption,
        );
        if (!result) return;
        await updateField({job: j, field: fieldName, value: result.item.id, isRecurring: j.preBook});
        await refreshAndNotify();
    }, [ensureAutoCompleteDialog, updateField, refreshAndNotify]);

    // ── Address Handlers ───────────────────────────────────────────

    const handleEditAddress = useCallback(async (isDelivery: boolean) => {
        const j = jobRef.current;
        if (!j) return;
        await ensureAddressDialog();
        const existing = isDelivery ? j.deliveryAddress : j.pickupAddress;
        const result = await window.ReactEditAddressDialog?.open(
            existing as any,
            undefined,
            undefined,
            undefined,
            isUsCustomer,
            undefined,
            isDelivery ? AddressType.Delivery : AddressType.Pickup,
        );
        if (!result) return;
        // Partner-job address edits never write locally — forward the captured
        // address (as the JSON shape the change-request dialog expects) to
        // the locked confirmation dialog. Only an approved change request
        // mutates the address on either side.
        if (j.isPartnerJob && onRequestPartnerChange) {
            const changeField = isDelivery ? 'DeliveryAddress' : 'PickupAddress';
            onRequestPartnerChange(changeField, serialisePartnerAddress(result as IAddressViewModel), true);
            return;
        }
        await updateAddress({job: j, address: result as any, isDelivery});
        await refreshAndNotify();
    }, [isUsCustomer, ensureAddressDialog, updateAddress, refreshAndNotify, onRequestPartnerChange]);

    const handleEditPickupAddress = useCallback(() => handleEditAddress(false), [handleEditAddress]);
    const handleEditDeliveryAddress = useCallback(() => handleEditAddress(true), [handleEditAddress]);

    const handleEditFromContact = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit From Contact Name', 'From Contact Name...', JobProperty.FromContactName, j.fromContactName);
    }, [openTextDialog]);

    const handleEditToContact = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit To Contact Name', 'To Contact Name...', JobProperty.ToContactName, j.deliverToContact);
    }, [openTextDialog]);

    const handleEditFromContactPhone = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit From Contact Phone', 'From Contact Phone...', JobProperty.FromContactPhone, j.fromContactNumber);
    }, [openTextDialog]);

    const handleEditToContactPhone = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit To Contact Phone', 'To Contact Phone...', JobProperty.ToContactPhone, j.toContactPhone);
    }, [openTextDialog]);

    // ── Toggle Handlers ────────────────────────────────────────────

    const handleToggleProperty = useCallback(async (property: string, currentValue: boolean) => {
        const j = jobRef.current;
        if (!j) return;
        const newValue = !currentValue;
        // Partner-job-gated toggles (e.g. Direct) never persist locally — route
        // the desired new state to the locked change-request dialog.
        if (tryRoutePartnerEdit(property, newValue)) return;
        const updates: Promise<unknown>[] = [
            updateField({job: j, field: property, value: newValue, isRecurring: j.preBook}),
        ];
        if (property === JobProperty.Reprice && newValue) {
            updates.push(updateField({job: j, field: JobProperty.InternalStatusID, value: 4, isRecurring: j.preBook}));
        }
        await Promise.all(updates);
        await refreshAndNotify();
    }, [updateField, refreshAndNotify, tryRoutePartnerEdit]);

    const handleVoidClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        if (!j.void) {
            await ensureVoidDialog();
            const result = await window.ReactVoidJobConfirmationDialog?.open({
                id: j.id,
                jobNo: j.jobNo,
                isBulkJob: j.isBulkJob,
                isArchived: j.isArchived,
            });
            if (result) {
                await refreshAndNotify();
                await invalidateJobLists();
            }
        } else {
            await updateField({job: j, field: JobProperty.Void, value: false, isRecurring: j.preBook});
            await refreshAndNotify();
        }
    }, [ensureVoidDialog, updateField, refreshAndNotify, invalidateJobLists]);

    const handleActiveClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        await updateField({job: j, field: JobProperty.Active, value: !j.active, isRecurring: true});
        await refreshAndNotify();
    }, [updateField, refreshAndNotify]);

    /**
     * Guided "mark as done" flow — replicates the AngularJS markJobAsDone behaviour.
     * Prompts for any missing POD fields, offers file upload, then completes.
     * @param startWith - which field to prompt for first ('time' = default, 'name' = POD Name first)
     */
    const markJobAsDone = useCallback(async (startWith: 'time' | 'name' = 'time') => {
        const j = jobRef.current;
        if (!j) return;

        const collectPodTime = async (): Promise<string | null> => {
            let podTime = j._completedTimeLongStr;
            if (!j.completedTime) {
                await ensureDateTimeDialog();
                const result = await window.ReactEditDateTimeDialog?.showEditDateAndTimeDialog({
                    title: 'POD Time',
                    fieldName: JobProperty.CompletedTime,
                    dateTime: j.completedTime,
                    defaultTimeZone: (j.deliveryTimeZone as any)?.text,
                });
                if (!result?.value) {
                    showToast('A POD time needs to be provided to close this job.', 'warning');
                    return null;
                }
                await updateField({job: j, field: JobProperty.CompletedTime, value: result.value, isRecurring: j.preBook, timezone: result.timezone});
                podTime = formatDateForApi(result.value, (j.deliveryTimeZone as any)?.text);
                await refreshAndNotify();
            }
            return podTime ?? null;
        };

        const collectPodName = async (): Promise<string | null> => {
            let podName = j.podName;
            if (!podName) {
                const name = await openTextDialogAsync('POD Name', 'POD Name...', JobProperty.PodName, '', 'Complete Job');
                if (!name) {
                    showToast('A POD name needs to be provided to close this job.', 'warning');
                    return null;
                }
                podName = name;
                await updateField({job: j, field: JobProperty.PodName, value: podName, isRecurring: j.preBook});
                await refreshAndNotify();
            }
            return podName;
        };

        let podTime: string | null | undefined;
        let podName: string | null | undefined;

        if (startWith === 'name') {
            podName = await collectPodName();
            if (podName === null) return;
            podTime = await collectPodTime();
            if (podTime === null) return;
        } else {
            podTime = await collectPodTime();
            if (podTime === null) return;
            podName = await collectPodName();
            if (podName === null) return;
        }

        // POD file upload (optional — user can skip by closing the dialog)
        try {
            await ensureJobFileUploadDialog();
            await window.ReactJobFileUploadDialog?.open?.(j.id, 'POD');
        } catch {
            // Upload dialog not available or user cancelled — continue
        }

        // Mark as done
        await updatePod({
            jobId: j.id,
            jobStatus: '6',
            podName: podName,
            podTime: podTime || '',
        });
        showToast(`${j.jobNo} Completed`, 'success');
        await refreshAndNotify();
        await invalidatePhotos();
    }, [ensureDateTimeDialog, ensureJobFileUploadDialog, openTextDialogAsync, updateField, updatePod, refreshAndNotify, invalidatePhotos, showToast]);

    const handleDoneClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        // Uncompleted: toggle done off
        if (j.done) {
            await updateField({job: j, field: JobProperty.Delivered, value: false, isRecurring: j.preBook});
            await refreshAndNotify();
            return;
        }
        // Completing: enter guided flow
        await markJobAsDone();
    }, [updateField, refreshAndNotify, markJobAsDone]);

    const handleTailLiftPuClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        if (j.tailLiftPu && (!j.parcelDimensions || j.parcelDimensions.length === 0)) {
            showToast('Please enter the parcels for this job before proceeding.', 'warning');
            return;
        }
        if (j.isBulkJob) {
            showToast('Tail Lift Pickup is not currently available for scheduled jobs.', 'warning');
            return;
        }
        await updateField({job: j, field: JobProperty.TailLiftPu, value: !j.tailLiftPu, isRecurring: j.preBook});
        await refreshAndNotify();
    }, [updateField, refreshAndNotify, showToast]);

    const handleTailLiftDoClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        if (j.tailLiftPu && (!j.parcelDimensions || j.parcelDimensions.length === 0)) {
            showToast('Please enter the parcels for this job before proceeding.', 'warning');
            return;
        }
        if (j.isBulkJob) {
            showToast('Tail Lift Drop-off is not currently available for scheduled jobs.', 'warning');
            return;
        }
        await updateField({job: j, field: JobProperty.TailLiftDo, value: !j.tailLiftDo, isRecurring: j.preBook});
        await refreshAndNotify();
    }, [updateField, refreshAndNotify, showToast]);

    const handlePrivateResChange = useCallback(async (isResidential: boolean) => {
        const j = jobRef.current;
        if (!j) return;
        if (j.isBulkJob) {
            showToast('Deliver to Private Residential is not currently available for scheduled jobs.', 'warning');
            return;
        }
        await updateField({job: j, field: JobProperty.DeliverToPrivateRes, value: isResidential, isRecurring: j.preBook});
        await refreshAndNotify();
    }, [updateField, refreshAndNotify, showToast]);

    // ── Field-Specific Handlers ────────────────────────────────────

    const handleCourierClick = useCallback(() => {
        // Opens the universal DispatchDialog. JobDetails owns the render —
        // we just toggle state and supply the confirm callbacks below.
        setDispatchDialog({open: true, initialType: 'Courier'});
    }, []);

    // Confirm: Courier / Agent / NP picked in the dispatch dialog. Routes the
    // write to the right server path:
    //   - Recurring tucJobBooking → updateField on CourierID / AgentId / NpAgentId
    //   - Non-recurring tucJob, type=Courier → dispatchJob (allocateJobs API)
    //   - Non-recurring tucJob, type=Agent/NP → updateField (server decides whether
    //     it's wired; errors surface in the dialog's submitError).
    const dispatchDialogConfirmCourier = useCallback(async (
        type: 'Courier' | 'Agent' | 'NP',
        destination: ISuggestion,
    ) => {
        const j = jobRef.current;
        if (!j) return;
        const targetField =
            type === 'Agent' ? JobProperty.AgentId :
            type === 'NP' ? JobProperty.NpAgentId :
            JobProperty.CourierID;

        try {
            if (!isRecurringJob && type === 'Courier') {
                await dispatchJob({job: j, courierId: destination.id});
            } else {
                await updateField({job: j, field: targetField, value: destination.id, isRecurring: j.preBook});
            }
            await refreshAndNotify();
            setDispatchDialog((s) => ({...s, open: false}));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Dispatch failed';
            throw new Error(message, {cause: err});
        }
    }, [isRecurringJob, dispatchJob, updateField, refreshAndNotify]);

    // Confirm: DFRNT Partner picked in the dispatch dialog. Sends the job to the
    // partner with the agreed rate. Recurring + bulk + archived jobs disable
    // this radio at the dialog level — this callback only fires for standard
    // active non-archived tucJobs.
    //
    // The IM round-trip can take several seconds, so we close the dialog
    // synchronously and surface progress via a sticky loading toast that morphs
    // into success/error when the call resolves. The dispatcher is free to
    // continue working in the meantime.
    const dispatchDialogConfirmPartner = useCallback(async (
        partner: ISuggestion,
        agreedRate: number,
    ): Promise<void> => {
        const j = jobRef.current;
        if (!j) return;
        setDispatchDialog((s) => ({...s, open: false}));
        const toast = toastService.showLoadingToast(
            `Sending job ${j.jobNo} to ${partner.text}…`,
        );
        sendToPartner(j.id, partner.id, agreedRate)
            .then(async (result) => {
                if (!result.success) {
                    toast.update(
                        result.message || `Failed to send job ${j.jobNo} to ${partner.text}`,
                        'error',
                    );
                    return;
                }
                toast.update(
                    `Job ${j.jobNo} sent to ${partner.text} — tracking: ${result.trackingNumber}`,
                    'success',
                );
                await refreshAndNotify();
            })
            .catch((err: unknown) => {
                const message = err instanceof Error && err.message
                    ? err.message
                    : `Failed to send job ${j.jobNo} to ${partner.text}`;
                toast.update(message, 'error');
            });
    }, [refreshAndNotify]);

    const handleEditPodName = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        if (j.done) {
            openTextDialog('Edit POD Name', 'POD Name...', JobProperty.PodName, j.podName);
            return;
        }
        await markJobAsDone('name');
    }, [openTextDialog, markJobAsDone]);

    const handleEditCompletedTime = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        if (j.done) {
            await editDateAndTime(JobProperty.CompletedTime, 'POD Time', j.completedTime, j.deliveryTimeZone);
            return;
        }
        await markJobAsDone('time');
    }, [editDateAndTime, markJobAsDone]);

    const handlePricingClick = useCallback(async (hideRecalculate?: boolean) => {
        const j = jobRef.current;
        if (!j) return;
        if (j.isInvoiced) {
            showToast(`Job ${j.jobNo} is invoiced and cannot be modified.`, 'warning');
            return;
        }
        // Partner-side mirrors don't carry the owner's customer breakdown. The only
        // commercially-meaningful field here is PartnerAgreedRate, which is set when
        // the job is dispatched and can only change through a Manual change request.
        // Capture the new rate via the regular edit dialog first, then open the
        // change-request dialog with the field + value locked so the user only
        // adds a reason for the counterparty.
        if (j.isPartnerJob) {
            if (!onRequestPartnerChange) {
                showToast(`${j.jobNo} is managed by a partner. Use Request Change to negotiate the agreed rate.`, 'info');
                return;
            }
            const newRate = await openTextDialogAsync(
                'New agreed rate',
                'Agreed rate...',
                'PartnerAgreedRate',
                '',
                'Continue',
            );
            if (newRate === null || newRate.trim() === '') return;
            onRequestPartnerChange('PartnerAgreedRate', newRate.trim(), true);
            return;
        }
        const breakdowns = await getPriceBreakdowns(j.id, j.preBook, j.isArchived);
        const isUsingOldAmountMethod = !isUsCustomer && breakdowns.length === 0;
        if (isUsingOldAmountMethod) {
            await ensureSimplePriceEditDialog();
            window.ReactSimplePriceEditDialog?.setToastService({showToast});
            await window.ReactSimplePriceEditDialog?.open({
                jobId: j.id,
                jobNumber: j.jobNo,
                currentCharge: j.charge,
                isPrebook: j.preBook,
                isBulk: j.isBulkJob,
                hideRecalculate: hideRecalculate === true,
            });
        } else {
            await ensurePriceBreakdownDialog();
            window.ReactPriceBreakdownDialog?.setToastService({showToast});
            await window.ReactPriceBreakdownDialog?.open(breakdowns, j.id, j.preBook, j.isArchived);
        }
        await refreshAndNotify();
    }, [isUsCustomer, ensureSimplePriceEditDialog, ensurePriceBreakdownDialog, showToast, refreshAndNotify, onRequestPartnerChange, openTextDialogAsync]);

    const handleStatusClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        const statusList = await getStatusList();
        await ensureSelectDialog();
        const result = await window.ReactSelectDialog?.showSelectDialog({
            title: 'Status',
            fieldName: JobProperty.Status,
            items: statusList,
            initialValue: j.statusName,
        });
        if (!result) return;
        await updateField({job: j, field: JobProperty.Status, value: result.value, isRecurring: j.preBook});
        await refreshAndNotify();
        onStatusChange?.(result.value as number);
    }, [ensureSelectDialog, updateField, refreshAndNotify, onStatusChange]);

    const handleSpeedClick = useCallback(async () => {
        const speeds = await getSpeedList();
        await showSelectDialog(speeds, JobProperty.SpeedID, 'Speed', jobRef.current?.speedName);
    }, [showSelectDialog]);

    const handleSizeClick = useCallback(async () => {
        const sizes = await getVehicleSizes();
        await showSelectDialog(sizes, JobProperty.Size, 'Size', jobRef.current?.size?.text ?? null);
    }, [showSelectDialog]);

    const handleJobTypeClick = useCallback(() => {
        return showSelectDialog(JOB_TYPE_OPTIONS, JobProperty.AcceptedJobTypeID, 'Job Type', jobRef.current?.jobTypeDescription);
    }, [showSelectDialog]);

    const handleDgClassClick = useCallback(() => {
        const opts = Array.from({length: 9}, (_, i) => ({id: i + 1, text: String(i + 1)}));
        return showSelectDialog(opts, JobProperty.DGClass, 'DG Class', jobRef.current?.dgClass ?? null, true, 'Has Documentation?');
    }, [showSelectDialog]);

    const handleLeaveClick = useCallback(async () => {
        const list = await getLeaveList();
        await showSelectDialog(list, JobProperty.DeliverToLeaveID, 'Leave Parcel', jobRef.current?.sigNotRequired || 'Signature Required');
    }, [showSelectDialog]);

    const handleTrackingMethodClick = useCallback(() => {
        const j = jobRef.current;
        return showSelectDialog(TRACKING_OPTIONS, JobProperty.TrackingMethod, 'Tracking Method', j?.trackingMethod ? TRACKING_OPTIONS.find(t => t.id === j.trackingMethod)?.text : undefined);
    }, [showSelectDialog]);

    const handleContactClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j?.clientId) return;
        const contacts = await getContactList(j.clientId);
        await showSelectDialog(contacts, JobProperty.FromContactName, 'From Contact Name', j.fromContactName);
    }, [showSelectDialog]);

    const handleClientClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        await showAutocompleteDialog('/home/ActiveClients', 'Start typing to enter new client...', JobProperty.ClientID, 'Client', {id: j.clientId, text: j.clientName}, true);
    }, [showAutocompleteDialog]);

    const handleInActiveByClick = useCallback(async () => {
        const staff = await getActiveStaff();
        await showSelectDialog(staff, JobProperty.InActiveDate, 'InActive By', jobRef.current?.inActiveBy?.text ?? '');
    }, [showSelectDialog]);

    const handleEditDimensions = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        await ensureParcelDimensionsDialog();
        window.ReactEditParcelDimensionsDialog?.setToastService({showToast});
        // Partner jobs route through the change-request dialog: the dimensions
        // dialog captures the parcels (no API call, no success toast) and we
        // forward them to the locked confirmation dialog so the user adds a
        // reason and the partner can approve. Bulk jobs never have a partner
        // pairing, so they keep the direct save path.
        const partnerMode = Boolean(j.isPartnerJob && !j.isBulkJob && onRequestPartnerChange);
        const result = await window.ReactEditParcelDimensionsDialog?.showEditParcelDimensionsDialog({
            jobId: j.isBulkJob ? undefined : j.id,
            bulkJobId: j.isBulkJob ? j.id : undefined,
            parcels: j.parcelDimensions || [],
            isUsCustomer: isUsCustomer,
            jobWeight: j.weight,
            partnerMode,
        });
        if (!result) return;
        if (partnerMode && onRequestPartnerChange) {
            const payload = JSON.stringify({
                parcels: result.parcels,
                weight: result.totalWeight > 0 ? result.totalWeight : undefined,
            });
            onRequestPartnerChange('Packages', payload, true);
            return;
        }
        await Promise.all([refreshAndNotify(), invalidateAllJobDetails()]);
        if (!j.isBulkJob) {
            const jobForRate = j.rootParentId
                ? (relatedJobs.find(rj => rj.id === j.rootParentId) ?? j)
                : j;
            if (!jobForRate.ratedManually) {
                await checkForRateChange(jobForRate);
            }
        }
    }, [ensureParcelDimensionsDialog, isUsCustomer, showToast, refreshAndNotify, checkForRateChange, invalidateAllJobDetails, relatedJobs, onRequestPartnerChange]);

    const handleEditRefA = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit RefA', 'RefA...', JobProperty.RefA, j.refA);
    }, [openTextDialog]);

    const handleEditRefB = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit RefB', 'RefB...', JobProperty.RefB, j.refB);
    }, [openTextDialog]);

    const handleEditOurRef = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit Our Reference', 'Our Reference...', JobProperty.OurRef, j.ourRef);
    }, [openTextDialog]);

    const handleEditConNote = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit AWB', 'AWB...', JobProperty.ConNote, j.conNote);
    }, [openTextDialog]);

    const handleEditWeight = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit Weight', 'Job Weight...', JobProperty.Weight, j.weight);
    }, [openTextDialog]);

    const handleEditTrackingMobile = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit Tracking Mobile', 'Tracking Mobile...', JobProperty.TrackingMobile, j.trackingMobile);
    }, [openTextDialog]);

    const handleEditTrackingEmail = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit Tracking Email', 'Tracking Email...', JobProperty.TrackingEmail, j.trackingEmail);
    }, [openTextDialog]);

    const handleEditCustomJobName = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit Job Name', 'Job Name...', JobProperty.CustomJobName, j.customJobName);
    }, [openTextDialog]);

    // ── POD Handlers ───────────────────────────────────────────────

    const handlePodUpload = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        (window as any).ReactJobFileUploadDialog?.open?.(j.id, 'POD');
    }, []);

    const handlePodReport = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        window.open(getPodReportUrl(j.id), '_blank');
    }, []);

    const handlePodSpreadsheet = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        window.open(getPodSpreadsheetUrl(j.id), '_blank');
    }, []);

    const handleSendPodEmail = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        await ensureSendPodDialog();
        const result = await window.ReactSendPodDialog?.open({
            jobId: j.id,
            jobNo: j.jobNo,
            clientName: j.clientName,
            driverName: j.courierData?.courierName || '',
            deliveryAddress: j.deliveryAddress?.fullAddress || '',
            deliveryDateTime: j._completedTimeLongStr || '',
            bookingContactEmail: j.bookingContactEmail || undefined,
            trackingEmail: j.trackingEmail || undefined,
        });
        if (result) {
            showToast('POD report email sent successfully', 'success');
        }
    }, [ensureSendPodDialog, showToast]);

    // ── Recurring Job Handlers ─────────────────────────────────────

    const handleDaysOfWeekChange = useCallback(async (days: DaysOfWeek[]) => {
        const j = jobRef.current;
        if (!j) return;
        const daysValue = DaysOfWeekHelpers.arrayToBitwise(days);
        await updateField({job: j, field: JobProperty.DaysOfWeek, value: daysValue, isRecurring: j.preBook});
        await refreshAndNotify();
    }, [updateField, refreshAndNotify]);

    const handleFrequencyChange = useCallback(async (frequency: number) => {
        const j = jobRef.current;
        if (!j) return;
        await updateField({job: j, field: JobProperty.Frequency, value: frequency, isRecurring: j.preBook});
        await refreshAndNotify();
    }, [updateField, refreshAndNotify]);

    // Recurring Route assignment. null clears the assignment (operator
    // picks "None" in the dropdown). Empty string lands on the C#
    // RecurringJobRepository's null-check branch which sets RouteId to
    // NULL via ExecuteUpdate, cascading through the booking tree.
    const handleRouteChange = useCallback(async (routeId: number | null) => {
        const j = jobRef.current;
        if (!j) return;
        const value = routeId === null || routeId === undefined ? '' : String(routeId);
        await updateField({job: j, field: JobProperty.RouteId, value, isRecurring: j.preBook});
        await refreshAndNotify();
    }, [updateField, refreshAndNotify]);

    const handleHolidayOptionChange = useCallback(async (option: number) => {
        const j = jobRef.current;
        if (!j) return;
        await updateField({job: j, field: JobProperty.HolidayDelivery, value: option, isRecurring: j.preBook});
        await refreshAndNotify();
    }, [updateField, refreshAndNotify]);

    const handleEditFirstDue = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        return editDate(JobProperty.FirstDue, 'First Due', j.firstDue);
    }, [editDate]);

    const handleEditStopDate = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        return editDate(JobProperty.StopDate, 'Stop Date', j.stopDate);
    }, [editDate]);

    const handleEditRestartDate = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        return editDate(JobProperty.RestartDate, 'Restart Date', j.restartDate);
    }, [editDate]);

    // ── Saved Flight (recurring flight bookings) ───────────────────

    const handleEditSavedFlight = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        setSavedFlightDialog({
            open: true,
            bookingId: j.id,
            fromAirportId: j.fromAirportId,
            toAirportId: j.toAirportId,
            currentValue: j.savedFlightNumber,
            departureDate: j.nextDue ?? j.firstDue,
        });
    }, []);

    // Opens the add-flight dialog for a recurring booking with no route yet.
    // The dialog collects From/To airports + flight number; on confirm we
    // persist all three so push-to-live auto-assign can match.
    const handleAddFlight = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        setSavedFlightDialog({
            open: true,
            bookingId: j.id,
            fromAirportId: j.fromAirportId,
            toAirportId: j.toAirportId,
            currentValue: j.savedFlightNumber,
            departureDate: j.nextDue ?? j.firstDue,
            showAirportPickers: true,
        });
    }, []);

    const savedFlightDialogConfirm = useCallback(async (
        flightNumber: string,
        airports?: {fromAirportId: number; toAirportId: number},
    ) => {
        const j = jobRef.current;
        setSavedFlightDialog((s) => ({...s, open: false}));
        if (!j) return;
        if (airports) {
            // Route + flight saved together via the dedicated atomic endpoint.
            await saveRecurringFlight(j.id, airports.fromAirportId, airports.toAirportId, flightNumber);
        } else {
            await updateField({job: j, field: JobProperty.SavedFlightNumber, value: flightNumber, isRecurring: true});
        }
        await refreshAndNotify();
    }, [updateField, refreshAndNotify]);

    // ── Missing Field Edit Handlers ────────────────────────────────

    const handleEditAmount = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit Amount', 'Amount...', JobProperty.Amount, j.charge);
    }, [openTextDialog]);

    const handleEditItems = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit Items', 'Items...', JobProperty.Items, j.items);
    }, [openTextDialog]);

    const handleEditClientCode = useCallback(() => {
        const j = jobRef.current;
        if (!j) return;
        openTextDialog('Edit Client Code', 'Client Code...', JobProperty.ClientCode, (j as any).clientCode);
    }, [openTextDialog]);

    // ── Lock/Unlock ────────────────────────────────────────────────

    const handleLockToggle = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        await updateField({job: j, field: JobProperty.Locked, value: !j.locked, isRecurring: j.preBook});
        await refreshAndNotify();
    }, [updateField, refreshAndNotify]);

    // ── Notify / Accepted ──────────────────────────────────────────

    const handleNotifyClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        await showSelectDialog(NOTIFY_OPTIONS, JobProperty.NotifiedType, 'Notified', j.notifiedName);
    }, [showSelectDialog]);

    const handleAcceptedClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        await showSelectDialog(ACCEPTED_OPTIONS, JobProperty.AcceptedType, 'Accepted', j.acceptedName);
    }, [showSelectDialog]);

    // ── Undeliverable ──────────────────────────────────────────────

    const handleUndeliverableClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        const list = await getUndeliverableList();
        await showSelectDialog(list, JobProperty.UndeliverableLocationID, 'Undeliverable Location', null);
    }, [showSelectDialog]);

    // ── Internal Status ────────────────────────────────────────────

    const handleInternalStatusClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        const list = await getInternalStatusList();
        const items = list.map(s => ({id: s.id, text: s.text}));
        await showSelectDialog(items, JobProperty.InternalStatusID, 'Internal Status', j.internalStatusId ?? null);
    }, [showSelectDialog]);

    // ── Push to Live (Bulk Jobs) ───────────────────────────────────

    const handlePushToLive = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        const {releaseBulkJob} = await import('../../../../services/jobListApi');
        try {
            const {jobNumbers} = await releaseBulkJob(j.id);
            const joined = jobNumbers.join(', ');

            let copied = false;
            try {
                await navigator.clipboard.writeText(joined);
                copied = true;
            } catch {
                // clipboard.writeText rejects in insecure contexts or when the
                // document loses focus; release succeeded, so just skip the copy.
            }

            const copySuffix = copied ? ' (copied to clipboard)' : '';
            showToast(`Bulk job ${j.jobNo} sent to live — ${joined}${copySuffix}`, 'success');
            await refreshAndNotify();
        } catch (err) {
            const message = (err as {message?: string})?.message ?? 'Failed to send bulk job to live';
            showToast(message, 'error');
        }
    }, [showToast, refreshAndNotify]);

    // ── Pallet CRUD ────────────────────────────────────────────────

    const handleNewPallet = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        (window as any).ReactPalletDialog?.open?.({jobId: j.id, isBulkJob: j.isBulkJob});
        await refreshAndNotify();
    }, [refreshAndNotify]);

    const handleEditPallet = useCallback(async (pallet: any) => {
        const j = jobRef.current;
        if (!j) return;
        (window as any).ReactPalletDialog?.open?.({jobId: j.id, isBulkJob: j.isBulkJob, existingPallet: pallet});
        await refreshAndNotify();
    }, [refreshAndNotify]);

    return {
        // Text dialog state
        textDialog,
        handleTextDialogSubmit,
        handleTextDialogCancel,

        // Dialog primitives (exposed for MetricsGrid)
        editDateAndTime,

        // Address
        handleEditPickupAddress,
        handleEditDeliveryAddress,
        handleEditFromContact,
        handleEditToContact,
        handleEditFromContactPhone,
        handleEditToContactPhone,

        // Toggles
        handleToggleProperty,
        handleVoidClick,
        handleActiveClick,
        handleDoneClick,
        handleTailLiftPuClick,
        handleTailLiftDoClick,
        handlePrivateResChange,

        // Field-specific
        handleCourierClick,
        handleEditPodName,
        handleEditCompletedTime,
        handlePricingClick,
        handleStatusClick,
        handleSpeedClick,
        handleSizeClick,
        handleJobTypeClick,
        handleDgClassClick,
        handleLeaveClick,
        handleTrackingMethodClick,
        handleContactClick,
        handleClientClick,
        handleInActiveByClick,
        handleEditDimensions,
        handleEditRefA,
        handleEditRefB,
        handleEditOurRef,
        handleEditConNote,
        handleEditWeight,
        handleEditTrackingMobile,
        handleEditTrackingEmail,
        handleEditCustomJobName,

        // POD
        handlePodUpload,
        handlePodReport,
        handlePodSpreadsheet,
        handleSendPodEmail,

        // Recurring
        handleDaysOfWeekChange,
        handleFrequencyChange,
        handleRouteChange,
        handleHolidayOptionChange,
        handleEditFirstDue,
        handleEditStopDate,
        handleEditRestartDate,
        handleEditSavedFlight,
        handleAddFlight,

        // Saved-flight dialog — JobDetails renders the dialog and wires these back.
        savedFlightDialog,
        closeSavedFlightDialog,
        savedFlightDialogConfirm,

        // Missing field editors
        handleEditAmount,
        handleEditItems,
        handleEditClientCode,

        // Lock/Unlock
        handleLockToggle,

        // Notify / Accepted
        handleNotifyClick,
        handleAcceptedClick,

        // Undeliverable
        handleUndeliverableClick,

        // Internal Status
        handleInternalStatusClick,

        // Push to Live
        handlePushToLive,

        // Pallet CRUD
        handleNewPallet,
        handleEditPallet,

        // Universal dispatch dialog — JobDetails renders the dialog and wires
        // these callbacks back to the hook so this hook still owns dispatch logic.
        dispatchDialog,
        closeDispatchDialog,
        dispatchDialogConfirmCourier,
        dispatchDialogConfirmPartner,
    };
}
