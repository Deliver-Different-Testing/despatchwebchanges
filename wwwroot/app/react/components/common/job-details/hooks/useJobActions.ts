/**
 * useJobActions - Extracts all job-specific click/edit handlers from JobDetails.
 *
 * Groups dialog integration, field editing, toggle, and recurring-job handlers
 * into a single hook so the root component stays focused on layout and rendering.
 */

import {useState, useCallback, useRef, useEffect} from 'react';
import type {IJob, IAddressViewModel, UpdatePodDetailsRequest} from '../JobDetails.types';
import {JOB_TYPE_OPTIONS, TRACKING_OPTIONS, NOTIFY_OPTIONS, ACCEPTED_OPTIONS} from '../JobDetails.types';
import {JobProperty} from '../../../../../enums/job-property.enum';
import {DaysOfWeek, DaysOfWeekHelpers} from '../../../../../enums/days-of-week.enum';
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
} from '../../../../services/jobDetailApi';

interface TextDialogState {
    open: boolean;
    title: string;
    label: string;
    initialValue: string;
    field: string;
    okLabel?: string;
    onSubmitExtra?: () => void;
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
    onStatusChange?: (statusId: number) => void;
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
    onStatusChange,
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

    // Stable ref for job so callbacks don't recreate on every job change.
    // Assigned synchronously (not via useEffect) so it's never one render behind.
    const jobRef = useRef(job);
    jobRef.current = job;

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
        } else {
            // State-based flow: save field directly (existing behavior)
            await updateField({job: j, field: dialog.field, value, isRecurring: j.preBook});
            dialog.onSubmitExtra?.();
            await refreshAndNotify();
        }
    }, [updateField, refreshAndNotify]);

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
        if (j.isBulkJob) {
            const {updateBulkJobDetail} = await import('../../../../services/jobDetailApi');
            await updateBulkJobDetail(j.id, result.fieldName, result.value, result.timezone);
        } else {
            const {updateJobDetail} = await import('../../../../services/jobDetailApi');
            await updateJobDetail(j.id, result.fieldName, result.value, j.preBook, result.timezone);
        }
        showToast(`${j.jobNo} updated`, 'success');
        await refreshAndNotify();
    }, [ensureDateTimeDialog, showToast, refreshAndNotify]);

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
        await updateField({job: j, field: result.fieldName, value: result.value, isRecurring: j.preBook, timezone: result.timezone});
        await refreshAndNotify();
    }, [ensureDateTimeDialog, updateField, refreshAndNotify]);

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

        if (fieldName === JobProperty.DGClass && result.checkboxValue !== undefined) {
            await updateField({job: j, field: fieldName, value: result.value, isRecurring: j.preBook});
            if (j.dgDocumentation !== result.checkboxValue) {
                await updateField({job: j, field: JobProperty.DGDocumentation, value: result.checkboxValue, isRecurring: j.preBook});
            }
        } else {
            await updateField({job: j, field: fieldName, value: result.value, isRecurring: j.preBook});
        }
        await refreshAndNotify();
    }, [ensureSelectDialog, updateField, refreshAndNotify]);

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
        const result = await window.ReactEditAddressDialog?.open(existing as any, undefined, undefined, undefined, isUsCustomer);
        if (!result) return;
        await updateAddress({job: j, address: result as any, isDelivery});
        await refreshAndNotify();
    }, [isUsCustomer, ensureAddressDialog, updateAddress, refreshAndNotify]);

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
        const updates: Promise<unknown>[] = [
            updateField({job: j, field: property, value: !currentValue, isRecurring: j.preBook}),
        ];
        if (property === JobProperty.Reprice && !currentValue) {
            updates.push(updateField({job: j, field: JobProperty.InternalStatusID, value: 4, isRecurring: j.preBook}));
        }
        await Promise.all(updates);
        await refreshAndNotify();
    }, [updateField, refreshAndNotify]);

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

    const handleCourierClick = useCallback(async () => {
        const j = jobRef.current;
        if (!j) return;
        if (isRecurringJob) {
            await showAutocompleteDialog('/courier/AllActiveSearch', 'Search courier...', JobProperty.CourierID, 'Courier', j.assignedCourier, false);
        } else {
            await ensureAutoCompleteDialog();
            const result = await window.ReactAutoCompleteDialog?.open(
                'Courier',
                'Start typing to search courier...',
                (s: string) => autocompleteSearch(s, '/courier/AllActiveSearch'),
            );
            if (!result) return;
            await dispatchJob({job: j, courierId: result.item.id});
            await refreshAndNotify();
        }
    }, [isRecurringJob, ensureAutoCompleteDialog, showAutocompleteDialog, dispatchJob, refreshAndNotify]);

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
                hideRecalculate: hideRecalculate === true,
            });
        } else {
            await ensurePriceBreakdownDialog();
            await window.ReactPriceBreakdownDialog?.open(breakdowns, j.id, j.preBook, j.isArchived);
        }
        await refreshAndNotify();
    }, [isUsCustomer, ensureSimplePriceEditDialog, ensurePriceBreakdownDialog, showToast, refreshAndNotify]);

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
        const result = await window.ReactEditParcelDimensionsDialog?.showEditParcelDimensionsDialog({
            jobId: j.isBulkJob ? undefined : j.id,
            bulkJobId: j.isBulkJob ? j.id : undefined,
            parcels: j.parcelDimensions || [],
            isUsCustomer: isUsCustomer,
            jobWeight: j.weight,
        });
        if (!result) return;
        await refreshAndNotify();
        if (!j.isBulkJob && !j.ratedManually) {
            await checkForRateChange(j);
        }
    }, [ensureParcelDimensionsDialog, isUsCustomer, showToast, refreshAndNotify, checkForRateChange]);

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
        await releaseBulkJob(j.id);
        showToast(`Bulk job ${j.jobNo} sent to live successfully`, 'success');
        await refreshAndNotify();
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
        handleHolidayOptionChange,
        handleEditFirstDue,
        handleEditStopDate,
        handleEditRestartDate,

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
    };
}
