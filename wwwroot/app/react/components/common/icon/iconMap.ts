/**
 * MUI-icon → DFRNT-icon migration map.
 *
 * The migration off `@mui/icons-material` (284 distinct glyphs) replaces each
 * icon with a Lucide (UI chrome) or Tabler (transport/logistics) equivalent,
 * rendered through the {@link Icon} wrapper. This is the seed of the codemod
 * dictionary — the most-used glyphs are mapped here; extend it as the sweep
 * migrates each area. Keys are the `@mui/icons-material` component names.
 *
 * @example
 *   const {lib, component} = MUI_ICON_MAP.Close;
 *   <Icon {...{[lib]: component}} />
 */
import {
    X, Search, RefreshCw, Info, Check, CircleCheck, TriangleAlert,
    User, ChevronDown, ChevronUp, Pencil, Trash2, Plus, Send, Save,
    Settings, Menu, Mail, MessageSquare, Clock, Bell,
} from 'lucide-react';
import {
    IconTruck, IconPlane, IconMapPin, IconRoute, IconPackage,
} from '@tabler/icons-react';
import type {LucideIcon, TablerIcon} from './Icon';

/**
 * Discriminated union so `component`'s type is narrowed by `lib` — a `lucide`
 * entry carries a Lucide icon, a `tabler` entry a Tabler icon (their stroke
 * props differ, so they can't share one type). See {@link Icon}.
 */
export type IconMapEntry =
    | {lib: 'lucide'; component: LucideIcon}
    | {lib: 'tabler'; component: TablerIcon};

export const MUI_ICON_MAP: Record<string, IconMapEntry> = {
    // ── Lucide: generic UI chrome ────────────────────────────────────────
    Close: {lib: 'lucide', component: X},
    Search: {lib: 'lucide', component: Search},
    Refresh: {lib: 'lucide', component: RefreshCw},
    Info: {lib: 'lucide', component: Info},
    Check: {lib: 'lucide', component: Check},
    CheckCircle: {lib: 'lucide', component: CircleCheck},
    Warning: {lib: 'lucide', component: TriangleAlert},
    Person: {lib: 'lucide', component: User},
    ExpandMore: {lib: 'lucide', component: ChevronDown},
    ExpandLess: {lib: 'lucide', component: ChevronUp},
    Edit: {lib: 'lucide', component: Pencil},
    Delete: {lib: 'lucide', component: Trash2},
    Add: {lib: 'lucide', component: Plus},
    Send: {lib: 'lucide', component: Send},
    Save: {lib: 'lucide', component: Save},
    Settings: {lib: 'lucide', component: Settings},
    Menu: {lib: 'lucide', component: Menu},
    Email: {lib: 'lucide', component: Mail},
    Sms: {lib: 'lucide', component: MessageSquare},
    Schedule: {lib: 'lucide', component: Clock},
    AccessTime: {lib: 'lucide', component: Clock},
    Notifications: {lib: 'lucide', component: Bell},

    // ── Tabler: transport & logistics ────────────────────────────────────
    LocalShipping: {lib: 'tabler', component: IconTruck},
    Flight: {lib: 'tabler', component: IconPlane},
    AirplanemodeActive: {lib: 'tabler', component: IconPlane},
    LocationOn: {lib: 'tabler', component: IconMapPin},
    Route: {lib: 'tabler', component: IconRoute},
    Inventory2: {lib: 'tabler', component: IconPackage},
};

export default MUI_ICON_MAP;
