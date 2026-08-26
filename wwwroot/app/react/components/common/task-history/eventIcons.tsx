/**
 * Maps the Material icon name strings emitted by DeliveryJourneyService
 * (backend) to DFRNT icons, plus the icon → colour-tone map below.
 *
 * The string→component indirection is the point of this file: the glyph name is
 * *data*, so a call site cannot import the component directly.
 *
 * The icons are imported **directly**, not looked up in `icon/iconMap.ts` — see
 * the note in `SymbolIcon.tsx`: that dictionary is dynamically indexed and
 * cannot be tree-shaken, so importing it bundles all ~209 glyphs.
 */

import React from 'react';
import {Icon} from '../icon/Icon';
import {
    ArrowLeftRight, ArrowUp, Ban, Bell, Building2, Calendar,
    CalendarDays, Circle, CircleCheck, CircleDollarSign, CirclePlus, Clock,
    CreditCard, DollarSign, Gauge, Headset, Image, Lock,
    MessageSquare, Network, NotebookPen, NotebookText, PenTool, PhoneCall,
    QrCode, RefreshCcwDot, RefreshCw, Ruler, Scale, ShoppingCart,
    SquareCheckBig, StickyNote, Tag, TriangleAlert, Undo2, User,
    Wallet,
} from 'lucide-react';
import {
    IconBuildingWarehouse, IconBus, IconCar, IconMapPin,
    IconPackage, IconPlane, IconRoute, IconTruck,
} from '@tabler/icons-react';

/**
 * Backend icon name → the icon to render. Keys are the backend contract.
 * Keep alphabetical.
 */
export const EVENT_ICONS = {
    account_balance_wallet: {lib: 'lucide', component: Wallet},
    account_tree: {lib: 'lucide', component: Network},
    add_circle: {lib: 'lucide', component: CirclePlus},
    airport_shuttle: {lib: 'tabler', component: IconBus},
    attach_money: {lib: 'lucide', component: DollarSign},
    business: {lib: 'lucide', component: Building2},
    calendar_month: {lib: 'lucide', component: Calendar},
    cancel: {lib: 'lucide', component: Ban},
    check_circle: {lib: 'lucide', component: CircleCheck},
    contact_phone: {lib: 'lucide', component: PhoneCall},
    directions_car: {lib: 'tabler', component: IconCar},
    draw: {lib: 'lucide', component: PenTool},
    edit_note: {lib: 'lucide', component: NotebookPen},
    event: {lib: 'lucide', component: CalendarDays},
    flight: {lib: 'tabler', component: IconPlane},
    inventory_2: {lib: 'tabler', component: IconPackage},
    landscape: {lib: 'lucide', component: Image},
    local_shipping: {lib: 'tabler', component: IconTruck},
    location_on: {lib: 'tabler', component: IconMapPin},
    lock: {lib: 'lucide', component: Lock},
    notes: {lib: 'lucide', component: NotebookText},
    notifications: {lib: 'lucide', component: Bell},
    paid: {lib: 'lucide', component: CircleDollarSign},
    payments: {lib: 'lucide', component: CreditCard},
    person: {lib: 'lucide', component: User},
    pin_drop: {lib: 'tabler', component: IconMapPin},
    published_with_changes: {lib: 'lucide', component: RefreshCcwDot},
    qr_code_2: {lib: 'lucide', component: QrCode},
    report_problem: {lib: 'lucide', component: TriangleAlert},
    route: {lib: 'tabler', component: IconRoute},
    scale: {lib: 'lucide', component: Scale},
    schedule: {lib: 'lucide', component: Clock},
    shopping_cart: {lib: 'lucide', component: ShoppingCart},
    sms: {lib: 'lucide', component: MessageSquare},
    speed: {lib: 'lucide', component: Gauge},
    sticky_note_2: {lib: 'lucide', component: StickyNote},
    straight: {lib: 'lucide', component: ArrowUp},
    straighten: {lib: 'lucide', component: Ruler},
    support_agent: {lib: 'lucide', component: Headset},
    swap_horiz: {lib: 'lucide', component: ArrowLeftRight},
    tag: {lib: 'lucide', component: Tag},
    task: {lib: 'lucide', component: SquareCheckBig},
    undo: {lib: 'lucide', component: Undo2},
    update: {lib: 'lucide', component: RefreshCw},
    warehouse: {lib: 'tabler', component: IconBuildingWarehouse},
    warning: {lib: 'lucide', component: TriangleAlert},
} as const;

/** Rendered when the backend sends no name, or one we do not recognise. */
const FALLBACK = {lib: 'lucide', component: Circle} as const;

/** Resolves a backend icon name to its icon (never throws). */
export function getEventIconEntry(name: string | undefined | null) {
    return (name && EVENT_ICONS[name as keyof typeof EVENT_ICONS]) || FALLBACK;
}

export interface EventIconProps {
    /** The backend-supplied icon name, e.g. "pin_drop". */
    name: string | undefined | null;
    /** Px size. Defaults to the wrapper's dense UI size (20). */
    size?: number;
    color?: string;
    className?: string;
    style?: React.CSSProperties;
    'aria-label'?: string;
    'aria-hidden'?: boolean;
}

/** The timeline/dialog glyph for a delivery-journey event. */
export const EventIcon: React.FC<EventIconProps> = ({name, ...rest}) => {
    const {lib, component} = getEventIconEntry(name);
    // Stamp the resolved backend name so the glyph stays addressable in tests and
    // in the DOM — Lucide/Tabler generate no stable hook of their own.
    return <Icon {...{[lib]: component}} data-event-icon={name ?? 'unknown'} {...rest} />;
};

export type EventColorTone = 'success' | 'info' | 'warning' | 'error' | 'secondary';

const TONE_BY_ICON: Record<string, EventColorTone> = {
    // success — money + completion
    attach_money: 'success',
    payments: 'success',
    paid: 'success',
    account_balance_wallet: 'success',
    check_circle: 'success',
    draw: 'success',

    // error — destructive / problem states
    cancel: 'error',
    warning: 'error',
    report_problem: 'error',
    lock: 'error',

    // warning — time / scheduling
    schedule: 'warning',
    event: 'warning',
    calendar_month: 'warning',
    notifications: 'warning',
    undo: 'warning',

    // info — dispatch operations: assignments, status changes, movement
    add_circle: 'info',
    local_shipping: 'info',
    support_agent: 'info',
    flight: 'info',
    airport_shuttle: 'info',
    directions_car: 'info',
    swap_horiz: 'info',
    published_with_changes: 'info',
    route: 'info',
    person: 'info',
};

export function getEventColorTone(name: string | undefined | null): EventColorTone {
    if (!name) return 'secondary';
    return TONE_BY_ICON[name] ?? 'secondary';
}
