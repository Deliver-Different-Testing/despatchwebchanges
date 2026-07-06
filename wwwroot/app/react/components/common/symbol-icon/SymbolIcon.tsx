/**
 * SymbolIcon — renders an MUI SvgIcon from a Material Symbols glyph name.
 *
 * The app used to carry two icon systems in parallel: MUI `@mui/icons-material`
 * SvgIcons (the dominant convention) and the Material Symbols *font* (a
 * `<span className="material-symbols-outlined">glyph</span>`). The font was
 * only convenient where an icon is chosen by a string coming from data — box
 * definitions, action menus, stat tabs — so those call sites could keep a
 * plain `icon: string`.
 *
 * SymbolIcon closes that gap: string-driven call sites keep their string API
 * but render a real MUI SvgIcon, so the Material Symbols font is no longer
 * needed on the React surface. Every glyph the React app referenced is mapped
 * below; unknown names fall back to the same neutral square the panel shell
 * uses for an unrecognised box.
 */

import React from 'react';
import type {SvgIconProps} from '@mui/material/SvgIcon';

import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CategoryIcon from '@mui/icons-material/Category';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import DateRangeIcon from '@mui/icons-material/DateRange';
import DeleteIcon from '@mui/icons-material/Delete';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterListIcon from '@mui/icons-material/FilterList';
import FlagIcon from '@mui/icons-material/Flag';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import GridViewIcon from '@mui/icons-material/GridView';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MapIcon from '@mui/icons-material/Map';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import NoteIcon from '@mui/icons-material/Note';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PinDropIcon from '@mui/icons-material/PinDrop';
import PlaceIcon from '@mui/icons-material/Place';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import PublicOffIcon from '@mui/icons-material/PublicOff';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import SendToMobileIcon from '@mui/icons-material/SendToMobile';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import SpeedIcon from '@mui/icons-material/Speed';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TimelineIcon from '@mui/icons-material/Timeline';
import TopicIcon from '@mui/icons-material/Topic';
import TuneIcon from '@mui/icons-material/Tune';
import UndoIcon from '@mui/icons-material/Undo';
import VisibilityIcon from '@mui/icons-material/Visibility';

type IconComponent = React.ComponentType<SvgIconProps>;

/** Material Symbols glyph name → MUI SvgIcon. Keep additions alphabetical. */
const SYMBOL_MAP: Record<string, IconComponent> = {
    assignment: AssignmentIcon,
    calendar_month: CalendarMonthIcon,
    category: CategoryIcon,
    check_circle: CheckCircleIcon,
    chevron_right: ChevronRightIcon,
    close: CloseIcon,
    cloud_upload: CloudUploadIcon,
    crop_square: CropSquareIcon,
    cycle: AutorenewIcon,
    dashboard: GridViewIcon,
    date_range: DateRangeIcon,
    delete: DeleteIcon,
    directions_car: DirectionsCarIcon,
    document_scanner: DocumentScannerIcon,
    edit_calendar: EditCalendarIcon,
    expand_less: ExpandLessIcon,
    expand_more: ExpandMoreIcon,
    filter_alt: FilterAltIcon,
    filter_list: FilterListIcon,
    flag: FlagIcon,
    format_list_bulleted: FormatListBulletedIcon,
    inventory_2: Inventory2Icon,
    list_alt: ListAltIcon,
    local_shipping: LocalShippingIcon,
    lock: LockIcon,
    lock_open: LockOpenIcon,
    map: MapIcon,
    my_location: MyLocationIcon,
    note: NoteIcon,
    note_add: NoteAddIcon,
    overview: AssessmentIcon,
    package_2: Inventory2Icon,
    pause_circle: PauseCircleIcon,
    pin_drop: PinDropIcon,
    place: PlaceIcon,
    priority_high: PriorityHighIcon,
    public_off: PublicOffIcon,
    receipt_long: ReceiptLongIcon,
    rocket_launch: RocketLaunchIcon,
    search: SearchIcon,
    send: SendIcon,
    send_to_mobile: SendToMobileIcon,
    shuffle: ShuffleIcon,
    speed: SpeedIcon,
    sticky_note_2: StickyNote2Icon,
    support_agent: SupportAgentIcon,
    swap_calls: SwapCallsIcon,
    swap_horiz: SwapHorizIcon,
    task_alt: TaskAltIcon,
    timeline: TimelineIcon,
    topic: TopicIcon,
    tune: TuneIcon,
    undo: UndoIcon,
    visibility: VisibilityIcon,
};

export interface SymbolIconProps extends SvgIconProps {
    /** Material Symbols glyph name, e.g. "pin_drop". */
    name: string;
}

export const SymbolIcon: React.FC<SymbolIconProps> = ({name, ...svgProps}) => {
    const Icon = SYMBOL_MAP[name];
    if (!Icon) {
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn(`[SymbolIcon] Unknown glyph "${name}" — add it to SYMBOL_MAP.`);
        }
        return <CropSquareIcon {...svgProps} />;
    }
    return <Icon {...svgProps} />;
};

export default SymbolIcon;
