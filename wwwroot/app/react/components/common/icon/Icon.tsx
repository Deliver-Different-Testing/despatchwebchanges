/**
 * Icon — the single DFRNT icon wrapper (brand book p.17).
 *
 * Enforces the brand icon spec so no call site has to remember the props:
 *   - stroke width **1.25** on both libraries (Lucide defaults to 2, Tabler to 2).
 *   - one consistent size (defaults below).
 *
 * Decision rule for which library to pass:
 *   - **Tabler** (`tabler={IconTruck}`) — transport & logistics: trucks, vans,
 *     planes, routes, cargo, packages, maps, weather.
 *   - **Lucide** (`lucide={Search}`) — generic UI chrome: close, search, menu,
 *     settings, chevrons, bells, user, alerts.
 *
 * @example
 *   import {Search} from 'lucide-react';
 *   import {IconTruck} from '@tabler/icons-react';
 *   <Icon lucide={Search} />
 *   <Icon tabler={IconTruck} size={BRAND_ICON_SIZE} />
 */
import React from 'react';
import type {LucideIcon} from 'lucide-react';

/**
 * Lucide and Tabler disagree on the stroke prop — Lucide's `stroke` is the SVG
 * colour (`string`) and its width is `strokeWidth`, whereas Tabler's `stroke` IS
 * the width (`number`). So the two icon families can't share one prop type; the
 * wrapper takes each in its own real type and passes the correct width prop per
 * branch. `TablerIcon` is derived by `typeof` a known icon so it tracks the
 * package's actual component type without depending on its exported alias names.
 */
export type TablerIcon = typeof import('@tabler/icons-react')['IconTruck'];
export type {LucideIcon};

/** Brand icon stroke — applies to both libraries. */
export const DEFAULT_ICON_STROKE = 1.25;
/** Dense in-app UI default (controls, list rows, inline glyphs). */
export const UI_ICON_SIZE = 20;
/** Brand-book default for feature/marketing icons. */
export const BRAND_ICON_SIZE = 36;

export interface IconProps {
    /** A Lucide icon component (UI chrome). Mutually exclusive with `tabler`. */
    lucide?: LucideIcon;
    /** A Tabler icon component (transport/logistics). Mutually exclusive with `lucide`. */
    tabler?: TablerIcon;
    size?: number;
    /** Overrides the brand 1.25 stroke — rarely needed. */
    stroke?: number;
    color?: string;
    className?: string;
    'aria-label'?: string;
}

export const Icon: React.FC<IconProps> = ({
    lucide: Lucide,
    tabler: Tabler,
    size = UI_ICON_SIZE,
    stroke = DEFAULT_ICON_STROKE,
    ...rest
}) => {
    if (Lucide) {
        return <Lucide size={size} strokeWidth={stroke} {...rest} />;
    }
    if (Tabler) {
        return <Tabler size={size} stroke={stroke} {...rest} />;
    }
    return null;
};

export default Icon;
