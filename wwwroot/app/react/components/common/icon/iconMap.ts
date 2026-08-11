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
    User, ChevronDown, ChevronUp, ChevronRight, Pencil, Trash2, Plus, Send, Save,
    Settings, Menu, Mail, MessageSquare, Clock, Bell,
    CircleUserRound, ChartColumn, DollarSign, Calendar, ListX, LayoutDashboard,
    LayoutGrid, FilePen, Heart, Download, UserCog, EllipsisVertical,
    CircleCheckBig, Eye, EyeOff, Phone, HardHat, Crosshair, ChevronsRight,
    CloudUpload, CloudDownload, Camera, FileUp,
} from 'lucide-react';
import {
    IconTruck, IconPlane, IconPlaneOff, IconMapPin, IconRoute, IconPackage, IconMap,
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
    AccountCircle: {lib: 'lucide', component: CircleUserRound},
    Assessment: {lib: 'lucide', component: ChartColumn},
    AttachMoney: {lib: 'lucide', component: DollarSign},
    CalendarTodayOutlined: {lib: 'lucide', component: Calendar},
    ClearAll: {lib: 'lucide', component: ListX},
    Dashboard: {lib: 'lucide', component: LayoutDashboard},
    DashboardCustomize: {lib: 'lucide', component: LayoutGrid},
    Done: {lib: 'lucide', component: Check},
    DriveFileRenameOutline: {lib: 'lucide', component: FilePen},
    Favorite: {lib: 'lucide', component: Heart},
    FileDownload: {lib: 'lucide', component: Download},
    ManageAccounts: {lib: 'lucide', component: UserCog},
    MoreVert: {lib: 'lucide', component: EllipsisVertical},
    NavigateNext: {lib: 'lucide', component: ChevronRight},
    TaskAlt: {lib: 'lucide', component: CircleCheckBig},
    Visibility: {lib: 'lucide', component: Eye},
    VisibilityOff: {lib: 'lucide', component: EyeOff},
    Phone: {lib: 'lucide', component: Phone},
    Engineering: {lib: 'lucide', component: HardHat},
    MyLocation: {lib: 'lucide', component: Crosshair},
    DoubleArrow: {lib: 'lucide', component: ChevronsRight},
    CloudUpload: {lib: 'lucide', component: CloudUpload},
    CloudDownload: {lib: 'lucide', component: CloudDownload},
    CameraAlt: {lib: 'lucide', component: Camera},
    UploadFile: {lib: 'lucide', component: FileUp},

    // ── Tabler: transport & logistics ────────────────────────────────────
    LocalShipping: {lib: 'tabler', component: IconTruck},
    Flight: {lib: 'tabler', component: IconPlane},
    AirplanemodeActive: {lib: 'tabler', component: IconPlane},
    AirplanemodeInactive: {lib: 'tabler', component: IconPlaneOff},
    LocationOn: {lib: 'tabler', component: IconMapPin},
    Place: {lib: 'tabler', component: IconMapPin},
    Route: {lib: 'tabler', component: IconRoute},
    Inventory2: {lib: 'tabler', component: IconPackage},
    Map: {lib: 'tabler', component: IconMap},
};

export default MUI_ICON_MAP;
