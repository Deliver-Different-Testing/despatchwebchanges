/**
 * EditableField - Material Design list item: icon avatar + two-line text (label + value)
 *
 * Matches the AngularJS md-list-item md-2-line pattern.
 */

import React from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import type {SxProps, Theme} from '@mui/material/styles';
import type {SvgIconProps} from '@mui/material/SvgIcon';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StraightenIcon from '@mui/icons-material/Straighten';
import ScaleIcon from '@mui/icons-material/Scale';
import QrCodeIcon from '@mui/icons-material/QrCode';
import WarningIcon from '@mui/icons-material/Warning';
import DescriptionIcon from '@mui/icons-material/Description';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import NotificationsIcon from '@mui/icons-material/Notifications';
import EmailIcon from '@mui/icons-material/Email';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SourceIcon from '@mui/icons-material/Source';
import ContactsIcon from '@mui/icons-material/Contacts';
import LabelIcon from '@mui/icons-material/Label';
import SpeedIcon from '@mui/icons-material/Speed';
import CategoryIcon from '@mui/icons-material/Category';
import PhotoSizeSelectLargeIcon from '@mui/icons-material/PhotoSizeSelectLarge';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import TagIcon from '@mui/icons-material/Tag';
import BusinessIcon from '@mui/icons-material/Business';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import EventIcon from '@mui/icons-material/Event';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
    listItemTextSlotProps,
    listItemIconSx,
    listItemIconInnerSx,
    getListItemTextSlotProps,
} from '../JobDetails.styles';

const iconMap: Record<string, React.ComponentType<SvgIconProps>> = {
    person: PersonIcon,
    phone: PhoneIcon,
    phone_android: PhoneAndroidIcon,
    delivery_truck_speed: LocalShippingIcon,
    local_shipping: LocalShippingIcon,
    schedule: ScheduleIcon,
    straighten: StraightenIcon,
    scale: ScaleIcon,
    qr_code: QrCodeIcon,
    warning: WarningIcon,
    description: DescriptionIcon,
    package_2: Inventory2Icon,
    inventory_2: Inventory2Icon,
    notifications: NotificationsIcon,
    email: EmailIcon,
    account_circle: AccountCircleIcon,
    source: SourceIcon,
    contacts: ContactsIcon,
    label: LabelIcon,
    speed: SpeedIcon,
    category: CategoryIcon,
    photo_size_select_large: PhotoSizeSelectLargeIcon,
    bookmark: BookmarkIcon,
    bookmark_border: BookmarkBorderIcon,
    tag: TagIcon,
    business: BusinessIcon,
    person_off: PersonOffIcon,
    event: EventIcon,
    event_busy: EventBusyIcon,
    event_available: EventAvailableIcon,
};

interface EditableFieldProps {
    icon?: string;
    label: string;
    value: string | number | undefined | null;
    onClick?: () => void;
    disabled?: boolean;
    isEditMode?: boolean;
    isVisible?: boolean;
    onToggleVisibility?: ((fieldKey: string) => void) | (() => void);
    fieldKey?: string;
    dense?: boolean;
    sx?: SxProps<Theme>;
    endAdornment?: React.ReactNode;
}

const getDensePy = (dense?: boolean) => (dense ? 0.125 : 0.5);
const getDenseMinHeight = (dense?: boolean) => (dense ? 30 : 44);

export const EditableField = React.memo(({
                                             icon,
                                             label,
                                             value,
                                             onClick,
                                             disabled,
                                             isEditMode,
                                             isVisible = true,
                                             onToggleVisibility,
                                             fieldKey,
                                             dense,
                                             endAdornment,
                                         }: EditableFieldProps) => {
    const IconComponent = icon ? iconMap[icon] : undefined;
    const displayValue = value != null && value !== '' ? String(value) : '\u2014';

    const iconElement = !dense && IconComponent ? (
        <ListItemIcon sx={listItemIconSx}>
            <IconComponent sx={listItemIconInnerSx}/>
        </ListItemIcon>
    ) : undefined;

    const slotProps = dense ? getListItemTextSlotProps(true) : listItemTextSlotProps;

    const handleToggle = React.useCallback(() => {
        if (onToggleVisibility && fieldKey) {
            (onToggleVisibility as (fieldKey: string) => void)(fieldKey);
        } else if (onToggleVisibility) {
            (onToggleVisibility as () => void)();
        }
    }, [onToggleVisibility, fieldKey]);

    // Edit mode: show visibility toggle
    if (isEditMode) {
        return (
            <ListItem
                dense
                disablePadding
                secondaryAction={
                    onToggleVisibility ? (
                        <IconButton edge="end" size="small" onClick={handleToggle}>
                            {isVisible ? <VisibilityIcon sx={{fontSize: 18}}/> :
                                <VisibilityOffIcon sx={{fontSize: 18}}/>}
                        </IconButton>
                    ) : undefined
                }
                sx={{minHeight: dense ? 36 : 40}}
            >
                <ListItemButton dense onClick={handleToggle} sx={{py: getDensePy(dense)}}>
                    {iconElement}
                    <ListItemText
                        primary={label}
                        slotProps={{
                            primary: {
                                ...listItemTextSlotProps.primary,
                                color: isVisible ? 'text.primary' : 'text.disabled'
                            }
                        }}
                    />
                </ListItemButton>
            </ListItem>
        );
    }

    const isClickable = onClick && !disabled;

    // Normal mode with click handler
    if (isClickable) {
        return (
            <Collapse in={isVisible} unmountOnExit>
                <ListItemButton dense onClick={onClick} sx={{
                    py: getDensePy(dense),
                    minHeight: getDenseMinHeight(dense),
                    borderLeft: '2px solid transparent',
                    transition: (theme: Theme) => `all ${theme.transitions.duration.shortest}ms ease`,
                    '&:hover': {
                        borderLeftColor: 'primary.main',
                        bgcolor: 'action.hover',
                        '& .MuiListItemIcon-root .MuiSvgIcon-root': {
                            color: 'primary.main',
                        },
                    },
                }}>
                    {iconElement}
                    <ListItemText
                        primary={label}
                        secondary={displayValue}
                        slotProps={slotProps}
                    />
                    {endAdornment}
                </ListItemButton>
            </Collapse>
        );
    }

    // Non-clickable display
    return (
        <Collapse in={isVisible} unmountOnExit>
            <ListItem dense sx={{py: getDensePy(dense), minHeight: getDenseMinHeight(dense)}}>
                {iconElement}
                <ListItemText
                    primary={label}
                    secondary={displayValue}
                    slotProps={slotProps}
                />
                {endAdornment}
            </ListItem>
        </Collapse>
    );
});
