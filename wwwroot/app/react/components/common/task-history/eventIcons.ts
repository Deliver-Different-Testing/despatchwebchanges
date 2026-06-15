/**
 * Maps the Material icon name strings emitted by DeliveryJourneyService
 * (backend) to imported @mui/icons-material components. Tree-shaken imports
 * keep the bundle minimal while letting the timeline render a recognizable
 * icon per event type.
 */

import type {SvgIconComponent} from '@mui/icons-material';
import CircleIcon from '@mui/icons-material/Circle';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AirportShuttleIcon from '@mui/icons-material/AirportShuttle';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContactPhoneIcon from '@mui/icons-material/ContactPhone';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import DrawIcon from '@mui/icons-material/Draw';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EventIcon from '@mui/icons-material/Event';
import FlightIcon from '@mui/icons-material/Flight';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LandscapeIcon from '@mui/icons-material/Landscape';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LockIcon from '@mui/icons-material/Lock';
import NotesIcon from '@mui/icons-material/Notes';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PaidIcon from '@mui/icons-material/Paid';
import PaymentsIcon from '@mui/icons-material/Payments';
import PersonIcon from '@mui/icons-material/Person';
import PinDropIcon from '@mui/icons-material/PinDrop';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import RouteIcon from '@mui/icons-material/Route';
import ScaleIcon from '@mui/icons-material/Scale';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SmsIcon from '@mui/icons-material/Sms';
import SpeedIcon from '@mui/icons-material/Speed';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import StraightIcon from '@mui/icons-material/Straight';
import StraightenIcon from '@mui/icons-material/Straighten';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import TagIcon from '@mui/icons-material/Tag';
import TaskIcon from '@mui/icons-material/Task';
import UndoIcon from '@mui/icons-material/Undo';
import UpdateIcon from '@mui/icons-material/Update';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import WarningIcon from '@mui/icons-material/Warning';

const ICONS: Record<string, SvgIconComponent> = {
    account_balance_wallet: AccountBalanceWalletIcon,
    account_tree: AccountTreeIcon,
    airport_shuttle: AirportShuttleIcon,
    attach_money: AttachMoneyIcon,
    business: BusinessIcon,
    calendar_month: CalendarMonthIcon,
    cancel: CancelIcon,
    check_circle: CheckCircleIcon,
    contact_phone: ContactPhoneIcon,
    directions_car: DirectionsCarIcon,
    draw: DrawIcon,
    edit_note: EditNoteIcon,
    event: EventIcon,
    flight: FlightIcon,
    inventory_2: Inventory2Icon,
    landscape: LandscapeIcon,
    local_shipping: LocalShippingIcon,
    location_on: LocationOnIcon,
    lock: LockIcon,
    notes: NotesIcon,
    notifications: NotificationsIcon,
    paid: PaidIcon,
    payments: PaymentsIcon,
    person: PersonIcon,
    pin_drop: PinDropIcon,
    published_with_changes: PublishedWithChangesIcon,
    qr_code_2: QrCode2Icon,
    report_problem: ReportProblemIcon,
    route: RouteIcon,
    scale: ScaleIcon,
    schedule: ScheduleIcon,
    shopping_cart: ShoppingCartIcon,
    sms: SmsIcon,
    speed: SpeedIcon,
    sticky_note_2: StickyNote2Icon,
    straight: StraightIcon,
    straighten: StraightenIcon,
    support_agent: SupportAgentIcon,
    swap_horiz: SwapHorizIcon,
    tag: TagIcon,
    task: TaskIcon,
    undo: UndoIcon,
    update: UpdateIcon,
    warehouse: WarehouseIcon,
    warning: WarningIcon,
};

export function getEventIcon(name: string | undefined | null): SvgIconComponent {
    if (!name) return CircleIcon;
    return ICONS[name] ?? CircleIcon;
}

/**
 * Semantic color tone per icon, so the timeline marker color tracks the
 * event's meaning (money = green, time changes = amber, problems = red, etc.)
 * rather than its position in the list. Same event type → same color every
 * time.
 *
 * The theme defines info and primary as the same blue in the US palette
 * (#2196f3), so this map deliberately avoids using primary — we'd lose
 * differentiation between assignment events and generic edits under that
 * theme. Instead, dispatch operations (assignments, status changes,
 * movement) go to `info` (blue) and generic edits/notes/locations default
 * to `secondary` (warm gray), staying visually distinct in both themes.
 */
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
