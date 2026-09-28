import type {CourierDisplayMode} from '../../../interfaces/courierDisplayMode';

export type {CourierDisplayMode};

/**
 * The default below is only the fallback used before a user has ever saved a
 * choice — see `wwwroot/app/react/interfaces/courierDisplayMode.ts` for what
 * the setting itself means.
 */
export function defaultCourierDisplayMode(isUsCustomer: boolean): CourierDisplayMode {
    return isUsCustomer ? 'off' : 'number';
}

/**
 * Formats the courier label for the requested mode. Falls back to whatever of
 * name/number is actually available — a manually-picked courier (search, or
 * the US "All Drivers" overview) never carries a number, so "number"/"both"
 * degrade to the name rather than showing nothing.
 */
export function formatCourierDisplayLabel(
    mode: CourierDisplayMode,
    name?: string,
    number?: string,
): string | undefined {
    if (mode === 'off') return undefined;

    const parts: string[] = [];
    if (mode === 'name' || mode === 'both') {
        if (name) parts.push(name);
    }
    if (mode === 'number' || mode === 'both') {
        if (number) parts.push(number);
    }

    if (parts.length > 0) return parts.join(' · ');
    return name ?? number ?? undefined;
}
