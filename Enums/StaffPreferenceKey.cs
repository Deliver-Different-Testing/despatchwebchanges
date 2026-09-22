namespace DespatchWeb.Enums;

/// <summary>
/// Allow-listed keys for the generic StaffPreference store (one JSON blob per
/// key). Kept as an enum, rather than a free-form string, so the table can't
/// silently accumulate arbitrary keys from a compromised or buggy client —
/// add a member here when a page adopts StaffPreference for a new setting.
/// </summary>
public enum StaffPreferenceKey
{
    AutoMate,
    JobListColumnsDispatchJobList,
    JobListColumnsDispatchCurrentWork,
    JobListColumnsJobSearchJobList,
    JobListColumnsJobSearchBulkList,
    JobListColumnsNwNewJobList,
    JobListColumnsNwPodJobList,
    JobListColumnsNwRepriceJobList,
    DispatchAddressFormat,
    DispatchCourierDisplayMode,
    CourierMapDisplaySettings,
}
