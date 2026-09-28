/**
 * SymbolIcon — renders a DFRNT icon from a Material Symbols glyph name.
 *
 * Some call sites choose their icon from a **string that comes from data** — box
 * definitions, action menus, stat tabs, backend-supplied panel configs — so they
 * cannot import an icon component directly. Those keep a plain `icon: string`
 * and render it through here. That string→component indirection is the point of
 * this file and is deliberately preserved.
 *
 * The icons are imported **directly**, not looked up in `icon/iconMap.ts`.
 * That dictionary is one object literal over ~209 components indexed
 * dynamically, so esbuild cannot tree-shake it: importing it pulls *every* glyph
 * into the bundle (measured: +178 KB across `dist`). `iconMap` is a codemod and
 * test reference; runtime registries own their own imports.
 */

import React from 'react';
import {Icon} from '../icon/Icon';
import {
    ArrowLeftRight, Calendar, CalendarCog, CalendarRange, ChartColumn, ChartNoAxesGantt,
    ChevronDown, ChevronRight, ChevronUp, CircleCheck, CircleCheckBig, CircleDollarSign,
    CirclePause, ClipboardClock, ClipboardList, CloudUpload, Crosshair, Eye,
    FilePlus, FileStack, Filter, Flag, Folder, Gauge,
    GlobeLock, Headset, LayoutGrid, LifeBuoy, List, ListFilter,
    Lock, LockOpen, ReceiptText, RefreshCw, Rocket, ScanText,
    Search, Send, Shapes, Shuffle, SlidersHorizontal, Smartphone,
    Sparkles, Square, StickyNote, Trash2, TriangleAlert, Undo2,
    X,
} from 'lucide-react';
import {
    IconCar, IconMap, IconMapPin, IconPackage,
    IconTruck,
} from '@tabler/icons-react';


/**
 * Material Symbols glyph name → the icon to render. Keys are the *data*
 * contract (what a box definition or backend row says). Keep alphabetical.
 */
export const SYMBOL_MAP = {
    assignment: {lib: 'lucide', component: ClipboardList},
    calendar_month: {lib: 'lucide', component: Calendar},
    category: {lib: 'lucide', component: Shapes},
    check_circle: {lib: 'lucide', component: CircleCheck},
    chevron_right: {lib: 'lucide', component: ChevronRight},
    close: {lib: 'lucide', component: X},
    cloud_upload: {lib: 'lucide', component: CloudUpload},
    crop_square: {lib: 'lucide', component: Square},
    cycle: {lib: 'lucide', component: RefreshCw},
    dashboard: {lib: 'lucide', component: LayoutGrid},
    date_range: {lib: 'lucide', component: CalendarRange},
    delete: {lib: 'lucide', component: Trash2},
    directions_car: {lib: 'tabler', component: IconCar},
    docs_add_on: {lib: 'lucide', component: FileStack},
    document_scanner: {lib: 'lucide', component: ScanText},
    edit_calendar: {lib: 'lucide', component: CalendarCog},
    expand_less: {lib: 'lucide', component: ChevronUp},
    expand_more: {lib: 'lucide', component: ChevronDown},
    filter_alt: {lib: 'lucide', component: Filter},
    filter_list: {lib: 'lucide', component: ListFilter},
    flag: {lib: 'lucide', component: Flag},
    format_list_bulleted: {lib: 'lucide', component: List},
    inventory_2: {lib: 'tabler', component: IconPackage},
    list_alt: {lib: 'lucide', component: List},
    local_shipping: {lib: 'tabler', component: IconTruck},
    lock: {lib: 'lucide', component: Lock},
    lock_open: {lib: 'lucide', component: LockOpen},
    map: {lib: 'tabler', component: IconMap},
    my_location: {lib: 'lucide', component: Crosshair},
    new_releases: {lib: 'lucide', component: Sparkles},
    note: {lib: 'lucide', component: StickyNote},
    note_add: {lib: 'lucide', component: FilePlus},
    overview: {lib: 'lucide', component: ChartColumn},
    package_2: {lib: 'tabler', component: IconPackage},
    pause_circle: {lib: 'lucide', component: CirclePause},
    pending_actions: {lib: 'lucide', component: ClipboardClock},
    pin_drop: {lib: 'tabler', component: IconMapPin},
    place: {lib: 'tabler', component: IconMapPin},
    price_change: {lib: 'lucide', component: CircleDollarSign},
    priority_high: {lib: 'lucide', component: TriangleAlert},
    public_off: {lib: 'lucide', component: GlobeLock},
    receipt_long: {lib: 'lucide', component: ReceiptText},
    rocket_launch: {lib: 'lucide', component: Rocket},
    search: {lib: 'lucide', component: Search},
    send: {lib: 'lucide', component: Send},
    send_to_mobile: {lib: 'lucide', component: Smartphone},
    shuffle: {lib: 'lucide', component: Shuffle},
    speed: {lib: 'lucide', component: Gauge},
    sticky_note_2: {lib: 'lucide', component: StickyNote},
    support: {lib: 'lucide', component: LifeBuoy},
    support_agent: {lib: 'lucide', component: Headset},
    swap_calls: {lib: 'lucide', component: ArrowLeftRight},
    swap_horiz: {lib: 'lucide', component: ArrowLeftRight},
    task_alt: {lib: 'lucide', component: CircleCheckBig},
    timeline: {lib: 'lucide', component: ChartNoAxesGantt},
    topic: {lib: 'lucide', component: Folder},
    tune: {lib: 'lucide', component: SlidersHorizontal},
    undo: {lib: 'lucide', component: Undo2},
    visibility: {lib: 'lucide', component: Eye},
} as const;

/** Rendered for an unrecognised name — matches the panel shell's placeholder. */
const FALLBACK = {lib: 'lucide', component: Square} as const;

export interface SymbolIconProps {
    /** Material Symbols glyph name, e.g. "pin_drop". */
    name: string;
    /** Px size. Defaults to the wrapper's dense UI size (20). */
    size?: number;
    /** Any CSS colour, or a Mantine colour variable. Defaults to `currentColor`. */
    color?: string;
    className?: string;
    style?: React.CSSProperties;
    'aria-label'?: string;
    'aria-hidden'?: boolean;
}

export const SymbolIcon: React.FC<SymbolIconProps> = ({name, ...rest}) => {
    const entry = SYMBOL_MAP[name as keyof typeof SYMBOL_MAP];
    if (!entry && process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(`[SymbolIcon] Unknown glyph "${name}" — add it to SYMBOL_MAP.`);
    }
    const {lib, component} = entry ?? FALLBACK;
    // Stamp the requested glyph name so a data-driven icon stays addressable:
    // Lucide/Tabler emit no stable hook of their own.
    return <Icon {...{[lib]: component}} data-symbol-icon={name} {...rest} />;
};

export default SymbolIcon;
