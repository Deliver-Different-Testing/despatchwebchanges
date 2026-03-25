/**
 * useJobActions - Extracts all job-specific click/edit handlers from JobDetails.
 *
 * Groups dialog integration, field editing, toggle, and recurring-job handlers
 * into a single hook so the root component stays focused on layout and rendering.
 */

import {useState, useCallback, useRef} from 'react';
import type {IJob, IAddressViewModel} from '../JobDetails.types';
import {JOB_TYPE_OPTIONS, TRACKING_OPTIONS} from '../JobDetails.types';
import {JobProperty} from '../../../../../enums/job-property.enum';
import {DaysOfWeek, DaysOfWeekHelpers} from '../../../../../enums/days-of-week.enum';
import {useDialogLoader} from './useDialogLoader';
import {
    getSpeedList,
    getVehicleSizes,
    getLeaveList,
    getContactList,
    getStatusList,
    getActiveStaff,
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
    dispatchJob: (args: {job: IJob; courierId: number}) => Promise<unknown>;
    refreshAndNotify: () => Promise<void>;
}

export function useJobActions({
    job,
    isRecurringJob,
    isUsCustomer,
    showToast,
    updateField,
    updateAddress,
    dispatchJob,
    refreshAndNotify,
}: UseJobActionsOptions) {
    const {
        ensureSelectDialog,
        ensureDateTimeDialog,
        ensureAutoCompleteDialog,
        ensureAddressDialog,
        ensureVoidDialog,
        ensurePriceBreakdownDialog,
        ensureParcelDimensionsDialog,
        ensureSendPodDialog,
    } = useDialogLoader();

    // ── Text Dialog ────────────────────────────────────────────────

    const [textDialog, setTextDialog] = useState<TextDialogState>(emptyTextDialog);
    const textDialogRef = useRef(textDialog);
    textDialogRef.current = textDialog;

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

    const handleTextDialogSubmit = useCallback(async (value: string) => {
        if (!job) return;
        const dialog = textDialogRef.current;
        setTextDialog(emptyTextDialog);
        await updateField({job, field: dialog.field, value, isRecurring: job.preBook});
        dialog.onSubmitExtra?.();
        await refreshAndNotify();
    }, [job, updateField, refreshAndNotify]);

    const handleTextDialogCancel = useCallback(() => setTextDialog(emptyTextDialog), []);

    // ── Dialog Primitives ──────────────────────────────────────────

    const editDateAndTime = useCallback(async (field: string, title: string, dateTime?: unknown, timezone?: unknown) => {
        if (!job) return;
        await ensureDateTimeDialog();
        const result = await window.ReactEditDateTimeDialog?.showEditDateAndTimeDialog({
            title,
            fieldName: field,
            dateTime: dateTime as any,
            defaultTimeZone: timezone as any,
        });
        if (!result) return;
        if (job.isBulkJob) {
            const {updateBulkJobDetail} = await import('../../../../services/jobDetailApi');
            await updateBulkJobDetail(job.id, result.fieldName, result.value, result.timezone);
        } else {
            const {updateJobDetail} = await import('../../../../services/jobDetailApi');
            await updateJobDetail(job.id, result.fieldName, result.value, job.preBook, result.timezone);
        }
        showToast(`${job.jobNo} updated`, 'success');
        await refreshAndNotify();
    }, [job, ensureDateTimeDialog, showToast, refreshAndNotify]);

    const editDate = useCallback(async (field: string, title: string, dateTime?: unknown, timezone?: unknown) => {
        if (!job) return;
        await ensureDateTimeDialog();
        const result = await window.ReactEditDateTimeDialog?.showEditDateDialog({
            title,
            fieldName: field,
            dateTime: dateTime as any,
            defaultTimeZone: timezone as any,
        });
        if (!result) return;
        await updateField({job, field: result.fieldName, value: result.value, isRecurring: job.preBook, timezone: result.timezone});
        await refreshAndNotify();
    }, [job, ensureDateTimeDialog, updateField, refreshAndNotify]);

    const showSelectDialog = useCallback(async (
        items: Array<{id: number; text: string}>,
        fieldName: string,
        title: string,
        initialValue?: string | number | null,
        showCheckbox?: boolean,
        checkboxLabel?: string,
    ) => {
        if (!job) return;
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
            await updateField({job, field: fieldName, value: result.value, isRecurring: job.preBook});
            if (job.dgDocumentation !== result.checkboxValue) {
                await updateField({job, field: JobProperty.DGDocumentation, value: result.checkboxValue, isRecurring: job.preBook});
            }
        } else {
            await updateField({job, field: fieldName, value: result.value, isRecurring: job.preBook});
        }
        await refreshAndNotify();
    }, [job, ensureSelectDialog, updateField, refreshAndNotify]);

    const showAutocompleteDialog = useCallback(async (
        url: string,
        placeholder: string,
        fieldName: string,
        title: string,
        existingItem?: any,
        showRerateOption?: boolean,
    ) => {
        if (!job) return;
        await ensureAutoCompleteDialog();
        const result = await window.ReactAutoCompleteDialog?.open(
            title,
            placeholder,
            (searchTerm: string) => autocompleteSearch(searchTerm, url),
            existingItem,
            showRerateOption,
        );
        if (!result) return;
        await updateField({job, field: fieldName, value: result.item.id, isRecurring: job.preBook});
        await refreshAndNotify();
    }, [job, ensureAutoCompleteDialog, updateField, refreshAndNotify]);

    // ── Address Handlers ───────────────────────────────────────────

    const handleEditAddress = useCallback(async (isDelivery: boolean) => {
        if (!job) return;
        await ensureAddressDialog();
        const existing = isDelivery ? job.deliveryAddress : job.pickupAddress;
        const result = await window.ReactEditAddressDialog?.open(existing as any, undefined, undefined, undefined, isUsCustomer);
        if (!result) return;
        await updateAddress({job, address: result as any, isDelivery});
        await refreshAndNotify();
    }, [job, isUsCustomer, ensureAddressDialog, updateAddress, refreshAndNotify]);

    const handleEditPickupAddress = useCallback(() => handleEditAddress(false), [handleEditAddress]);
    const handleEditDeliveryAddress = useCallback(() => handleEditAddress(true), [handleEditAddress]);

    const handleEditFromContact = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit From Contact Name', 'From Contact Name...', JobProperty.FromContactName, job.fromContactName);
    }, [job, openTextDialog]);

    const handleEditToContact = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit To Contact Name', 'To Contact Name...', JobProperty.ToContactName, job.deliverToContact);
    }, [job, openTextDialog]);

    const handleEditFromContactPhone = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit From Contact Phone', 'From Contact Phone...', JobProperty.FromContactPhone, job.fromContactNumber);
    }, [job, openTextDialog]);

    const handleEditToContactPhone = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit To Contact Phone', 'To Contact Phone...', JobProperty.ToContactPhone, job.toContactPhone);
    }, [job, openTextDialog]);

    // ── Toggle Handlers ────────────────────────────────────────────

    const handleToggleProperty = useCallback(async (property: string, currentValue: boolean) => {
        if (!job) return;
        const updates: Promise<unknown>[] = [
            updateField({job, field: property, value: !currentValue, isRecurring: job.preBook}),
        ];
        if (property === JobProperty.Reprice && !currentValue) {
            updates.push(updateField({job, field: JobProperty.InternalStatusID, value: 4, isRecurring: job.preBook}));
        }
        await Promise.all(updates);
        await refreshAndNotify();
    }, [job, updateField, refreshAndNotify]);

    const handleVoidClick = useCallback(async () => {
        if (!job) return;
        if (!job.void) {
            await ensureVoidDialog();
            const result = await window.ReactVoidJobConfirmationDialog?.open({
                id: job.id,
                jobNo: job.jobNo,
                isBulkJob: job.isBulkJob,
                isArchived: job.isArchived,
            });
            if (result) await refreshAndNotify();
        } else {
            await updateField({job, field: JobProperty.Void, value: false, isRecurring: job.preBook});
            await refreshAndNotify();
        }
    }, [job, updateField, refreshAndNotify]);

    const handleActiveClick = useCallback(async () => {
        if (!job) return;
        await updateField({job, field: JobProperty.Active, value: !job.active, isRecurring: true});
        await refreshAndNotify();
    }, [job, updateField, refreshAndNotify]);

    const handleDoneClick = useCallback(async () => {
        if (!job) return;
        await updateField({job, field: JobProperty.Delivered, value: !job.done, isRecurring: job.preBook});
        await refreshAndNotify();
    }, [job, updateField, refreshAndNotify]);

    const handleTailLiftPuClick = useCallback(async () => {
        if (!job) return;
        if (job.tailLiftPu && (!job.parcelDimensions || job.parcelDimensions.length === 0)) {
            showToast('Please enter the parcels for this job before proceeding.', 'warning');
            return;
        }
        if (job.isBulkJob) {
            showToast('Tail Lift Pickup is not currently available for scheduled jobs.', 'warning');
            return;
        }
        await updateField({job, field: JobProperty.TailLiftPu, value: !job.tailLiftPu, isRecurring: job.preBook});
        await refreshAndNotify();
    }, [job, updateField, refreshAndNotify, showToast]);

    const handleTailLiftDoClick = useCallback(async () => {
        if (!job) return;
        if (job.tailLiftPu && (!job.parcelDimensions || job.parcelDimensions.length === 0)) {
            showToast('Please enter the parcels for this job before proceeding.', 'warning');
            return;
        }
        if (job.isBulkJob) {
            showToast('Tail Lift Drop-off is not currently available for scheduled jobs.', 'warning');
            return;
        }
        await updateField({job, field: JobProperty.TailLiftDo, value: !job.tailLiftDo, isRecurring: job.preBook});
        await refreshAndNotify();
    }, [job, updateField, refreshAndNotify, showToast]);

    const handlePrivateResChange = useCallback(async (isResidential: boolean) => {
        if (!job) return;
        if (job.isBulkJob) {
            showToast('Deliver to Private Residential is not currently available for scheduled jobs.', 'warning');
            return;
        }
        await updateField({job, field: JobProperty.DeliverToPrivateRes, value: isResidential, isRecurring: job.preBook});
        await refreshAndNotify();
    }, [job, updateField, refreshAndNotify, showToast]);

    // ── Field-Specific Handlers ────────────────────────────────────

    const handleCourierClick = useCallback(async () => {
        if (!job) return;
        if (isRecurringJob) {
            await showAutocompleteDialog('/courier/AllActiveSearch', 'Search courier...', JobProperty.CourierID, 'Courier', job.assignedCourier, false);
        } else {
            await ensureAutoCompleteDialog();
            const result = await window.ReactAutoCompleteDialog?.open(
                'Courier',
                'Start typing to search courier...',
                (s: string) => autocompleteSearch(s, '/courier/AllActiveSearch'),
            );
            if (!result) return;
            await dispatchJob({job, courierId: result.item.id});
            await refreshAndNotify();
        }
    }, [job, isRecurringJob, ensureAutoCompleteDialog, showAutocompleteDialog, dispatchJob, refreshAndNotify]);

    const handleEditPodName = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit POD Name', 'POD Name...', JobProperty.PodName, job.podName);
    }, [job, openTextDialog]);

    const handleEditCompletedTime = useCallback(async () => {
        if (!job) return;
        await editDateAndTime(JobProperty.CompletedTime, 'POD Time', job.completedTime, job.deliveryTimeZone);
    }, [job, editDateAndTime]);

    const handlePricingClick = useCallback(async () => {
        if (!job) return;
        if (job.isInvoiced) {
            showToast(`Job ${job.jobNo} is invoiced and cannot be modified.`, 'warning');
            return;
        }
        await ensurePriceBreakdownDialog();
        await window.ReactPriceBreakdownDialog?.open([], job.id, job.preBook, job.isArchived);
        await refreshAndNotify();
    }, [job, ensurePriceBreakdownDialog, showToast, refreshAndNotify]);

    const handleStatusClick = useCallback(async () => {
        if (!job) return;
        const statusList = await getStatusList();
        await showSelectDialog(statusList, JobProperty.Status, 'Status', job.statusName);
    }, [job, showSelectDialog]);

    const handleSpeedClick = useCallback(async () => {
        const speeds = await getSpeedList();
        await showSelectDialog(speeds, JobProperty.SpeedID, 'Speed', job?.speedName);
    }, [job, showSelectDialog]);

    const handleSizeClick = useCallback(async () => {
        const sizes = await getVehicleSizes();
        await showSelectDialog(sizes, JobProperty.Size, 'Size', job?.size?.text ?? null);
    }, [job, showSelectDialog]);

    const handleJobTypeClick = useCallback(() => {
        return showSelectDialog(JOB_TYPE_OPTIONS, JobProperty.AcceptedJobTypeID, 'Job Type', job?.jobTypeDescription);
    }, [job, showSelectDialog]);

    const handleDgClassClick = useCallback(() => {
        const opts = Array.from({length: 9}, (_, i) => ({id: i + 1, text: String(i + 1)}));
        return showSelectDialog(opts, JobProperty.DGClass, 'DG Class', job?.dgClass ?? null, true, 'Has Documentation?');
    }, [job, showSelectDialog]);

    const handleLeaveClick = useCallback(async () => {
        const list = await getLeaveList();
        await showSelectDialog(list, JobProperty.DeliverToLeaveID, 'Leave Parcel', job?.sigNotRequired || 'Signature Required');
    }, [job, showSelectDialog]);

    const handleTrackingMethodClick = useCallback(() => {
        return showSelectDialog(TRACKING_OPTIONS, JobProperty.TrackingMethod, 'Tracking Method', job?.trackingMethod ? TRACKING_OPTIONS.find(t => t.id === job.trackingMethod)?.text : undefined);
    }, [job, showSelectDialog]);

    const handleContactClick = useCallback(async () => {
        if (!job?.clientId) return;
        const contacts = await getContactList(job.clientId);
        await showSelectDialog(contacts, JobProperty.FromContactName, 'From Contact Name', job.fromContactName);
    }, [job, showSelectDialog]);

    const handleClientClick = useCallback(async () => {
        if (!job) return;
        await showAutocompleteDialog('/home/ActiveClients', 'Start typing to enter new client...', JobProperty.ClientID, 'Client', {id: job.clientId, text: job.clientName}, true);
    }, [job, showAutocompleteDialog]);

    const handleInActiveByClick = useCallback(async () => {
        const staff = await getActiveStaff();
        await showSelectDialog(staff, JobProperty.InActiveDate, 'InActive By', job?.inActiveBy?.text ?? '');
    }, [job, showSelectDialog]);

    const handleEditDimensions = useCallback(async () => {
        if (!job) return;
        await ensureParcelDimensionsDialog();
        await window.ReactEditParcelDimensionsDialog?.showEditParcelDimensionsDialog({
            jobId: job.isBulkJob ? undefined : job.id,
            bulkJobId: job.isBulkJob ? job.id : undefined,
            parcels: job.parcelDimensions || [],
            isUsCustomer: isUsCustomer,
        });
        await refreshAndNotify();
    }, [job, ensureParcelDimensionsDialog, refreshAndNotify]);

    const handleEditRefA = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit RefA', 'RefA...', JobProperty.RefA, job.refA);
    }, [job, openTextDialog]);

    const handleEditRefB = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit RefB', 'RefB...', JobProperty.RefB, job.refB);
    }, [job, openTextDialog]);

    const handleEditOurRef = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit Our Reference', 'Our Reference...', JobProperty.OurRef, job.ourRef);
    }, [job, openTextDialog]);

    const handleEditConNote = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit AWB', 'AWB...', JobProperty.ConNote, job.conNote);
    }, [job, openTextDialog]);

    const handleEditWeight = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit Weight', 'Job Weight...', JobProperty.Weight, job.weight);
    }, [job, openTextDialog]);

    const handleEditTrackingMobile = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit Tracking Mobile', 'Tracking Mobile...', JobProperty.TrackingMobile, job.trackingMobile);
    }, [job, openTextDialog]);

    const handleEditTrackingEmail = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit Tracking Email', 'Tracking Email...', JobProperty.TrackingEmail, job.trackingEmail);
    }, [job, openTextDialog]);

    const handleEditCustomJobName = useCallback(() => {
        if (!job) return;
        openTextDialog('Edit Job Name', 'Job Name...', JobProperty.CustomJobName, job.customJobName);
    }, [job, openTextDialog]);

    // ── POD Handlers ───────────────────────────────────────────────

    const handlePodUpload = useCallback(() => {
        if (!job) return;
        (window as any).ReactJobFileUploadDialog?.open?.(job.id, 'POD');
    }, [job]);

    const handlePodReport = useCallback(() => {
        if (!job) return;
        window.open(getPodReportUrl(job.id), '_blank');
    }, [job]);

    const handlePodSpreadsheet = useCallback(() => {
        if (!job) return;
        window.open(getPodSpreadsheetUrl(job.id), '_blank');
    }, [job]);

    const handleSendPodEmail = useCallback(async () => {
        if (!job) return;
        await ensureSendPodDialog();
        const result = await window.ReactSendPodDialog?.open({
            jobId: job.id,
            jobNo: job.jobNo,
            clientName: job.clientName,
            driverName: job.courierData?.courierName || '',
            deliveryAddress: job.deliveryAddress?.fullAddress || '',
            deliveryDateTime: job._completedTimeLongStr || '',
            bookingContactEmail: job.bookingContactEmail || undefined,
            trackingEmail: job.trackingEmail || undefined,
        });
        if (result) {
            showToast('POD report email sent successfully', 'success');
        }
    }, [job, ensureSendPodDialog, showToast]);

    // ── Recurring Job Handlers ─────────────────────────────────────

    const handleDaysOfWeekChange = useCallback(async (days: DaysOfWeek[]) => {
        if (!job) return;
        const daysValue = DaysOfWeekHelpers.arrayToBitwise(days);
        await updateField({job, field: JobProperty.DaysOfWeek, value: daysValue, isRecurring: job.preBook});
        await refreshAndNotify();
    }, [job, updateField, refreshAndNotify]);

    const handleFrequencyChange = useCallback(async (frequency: number) => {
        if (!job) return;
        await updateField({job, field: JobProperty.Frequency, value: frequency, isRecurring: job.preBook});
        await refreshAndNotify();
    }, [job, updateField, refreshAndNotify]);

    const handleHolidayOptionChange = useCallback(async (option: number) => {
        if (!job) return;
        await updateField({job, field: JobProperty.HolidayDelivery, value: option, isRecurring: job.preBook});
        await refreshAndNotify();
    }, [job, updateField, refreshAndNotify]);

    const handleEditFirstDue = useCallback(() => {
        if (!job) return;
        return editDate(JobProperty.FirstDue, 'First Due', job.firstDue);
    }, [job, editDate]);

    const handleEditStopDate = useCallback(() => {
        if (!job) return;
        return editDate(JobProperty.StopDate, 'Stop Date', job.stopDate);
    }, [job, editDate]);

    const handleEditRestartDate = useCallback(() => {
        if (!job) return;
        return editDate(JobProperty.RestartDate, 'Restart Date', job.restartDate);
    }, [job, editDate]);

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
    };
}
