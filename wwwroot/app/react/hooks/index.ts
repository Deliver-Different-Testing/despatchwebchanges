/**
 * React Hooks Exports
 *
 * Central export point for all custom React hooks.
 */

// Courier API hooks
export {useCourierSearch, useTimeZoneOptions} from './useCourierApi';

// Job API hooks
export {useRelatedJobs} from './useJobApi';

// Address API hooks
export {useAddressSearch, useLocationDetails, useHereMapsApiKey} from './useAddressApi';

// Recurring Jobs API hooks
export {useRecurringJobsList, useSpeedList} from './useRecurringJobsApi';

// Notes API hooks
export {
    useJobNotes,
    useBulkJobNotes,
    useNoteTypes,
    useCreateNote,
    useCreateBulkJobNote,
    useUpdateNote,
    useUpdateBulkJobNote,
    useDeleteNote,
    useCreateNoteType,
} from './useNotesApi';

// Price Breakdown API hooks
export {
    usePriceBreakdowns,
    useAddPriceBreakdown,
    useUpdatePriceBreakdown,
    useDeletePriceBreakdown,
} from './usePriceBreakdownApi';

// Tasks API hooks
export {
    useTasks,
    useActiveStaff,
    useEventTypes,
    useDeliveryJourney,
    useMarkTaskAsClosed,
    useUpdateTaskDate,
    useUpdateTaskTime,
    useReassignTask,
} from './useTasksApi';

// Driver Management API hooks
export {
    useDriverSearch,
    useCourierDetails,
    useFleetOptions,
    useTodayActiveDrivers,
    useComplianceList,
    useAfterHoursSchedule,
    useDriverEmails,
    useDriverEarnings,
    useCreateAfterHoursSchedule,
    useUpdateAfterHoursSchedule,
    useDeleteAfterHoursSchedule,
    useSendComplianceReminder,
    useSendBulkComplianceReminders,
    useSendEmailToCouriers,
} from './useDriverManagementApi';
