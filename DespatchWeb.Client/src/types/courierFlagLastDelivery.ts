/**
 * The place shown on the map courier flags' "last delivery" line, shared by the Dispatch map and the
 * Courier Map. A tenant default (Configurator → Dispatch Settings, tblSetting.CourierFlagLastDeliveryMode)
 * with a per-user override (StaffPreference key `CourierFlagLastDelivery`) — see
 * `services/courierFlagLastDeliveryPreference.ts`.
 *
 * Delivery address lines mean different things per country, hence the neutral names:
 * locality is line 5 (NZ suburb, US township/city), region is line 6 (NZ city, US state).
 */
export type LastDeliveryLabelMode = 'locality' | 'region' | 'localityRegion' | 'time' | 'off';

const MODES: readonly string[] = ['locality', 'region', 'localityRegion', 'time', 'off'];

export function isLastDeliveryLabelMode(value: unknown): value is LastDeliveryLabelMode {
    return typeof value === 'string' && MODES.includes(value);
}

/** The fallback when neither the user nor the tenant has chosen: US dispatchers asked for the township, NZ keeps the city. */
export function defaultLastDeliveryLabelMode(isUsCustomer: boolean): LastDeliveryLabelMode {
    return isUsCustomer ? 'locality' : 'region';
}

export function lastDeliveryLabelOptions(isUsCustomer: boolean): {value: LastDeliveryLabelMode; label: string}[] {
    return isUsCustomer
        ? [
            {value: 'locality', label: 'Township or city'},
            {value: 'region', label: 'State'},
            {value: 'localityRegion', label: 'Township and state'},
            {value: 'time', label: 'Time since delivery only'},
            {value: 'off', label: "Don't show"},
        ]
        : [
            {value: 'locality', label: 'Suburb'},
            {value: 'region', label: 'City'},
            {value: 'localityRegion', label: 'Suburb and city'},
            {value: 'time', label: 'Time since delivery only'},
            {value: 'off', label: "Don't show"},
        ];
}
