/**
 * Allow-listed StaffPreference keys — mirrors the backend's
 * `Enums/StaffPreferenceKey.cs`. Keep the two in sync: a key sent here that
 * isn't a member of the backend enum is rejected by StaffPreferenceController.
 */
export enum StaffPreferenceKey {
    AutoMate = 'AutoMate',
    JobListColumnsDispatchJobList = 'JobListColumnsDispatchJobList',
    JobListColumnsDispatchCurrentWork = 'JobListColumnsDispatchCurrentWork',
    JobListColumnsJobSearchJobList = 'JobListColumnsJobSearchJobList',
    JobListColumnsJobSearchBulkList = 'JobListColumnsJobSearchBulkList',
    JobListColumnsNwNewJobList = 'JobListColumnsNwNewJobList',
    JobListColumnsNwPodJobList = 'JobListColumnsNwPodJobList',
    JobListColumnsNwRepriceJobList = 'JobListColumnsNwRepriceJobList',
    DispatchAddressFormat = 'DispatchAddressFormat',
    DispatchCourierDisplayMode = 'DispatchCourierDisplayMode',
    CourierMapDisplaySettings = 'CourierMapDisplaySettings',
    ShowPanelHideButton = 'ShowPanelHideButton',
}
