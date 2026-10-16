/**
 * Per-user setting for how much courier info shows on the Dispatch page's
 * Current Work box title once a courier is focused. Persisted via
 * StaffPreference (key `DispatchCourierDisplayMode`).
 */
export type CourierDisplayMode = 'off' | 'name' | 'number' | 'both';
