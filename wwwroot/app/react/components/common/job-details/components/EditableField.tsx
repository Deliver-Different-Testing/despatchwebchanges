/**
 * EditableField - a two-line list row: icon gutter + label above value.
 *
 * Matches the AngularJS md-list-item md-2-line pattern.
 */

import React from 'react';
import {ActionIcon, Box, Collapse, Text, UnstyledButton} from '@mantine/core';
import {
    Award, BadgeCheck, Bell, Bookmark, Building2, Calendar, CalendarCheck, CalendarX,
    CircleUserRound, Clock, Contact, Eye, EyeOff, FileText, Gauge, Hash, IdCard, Import,
    Mail, Maximize, Phone, QrCode, Ruler, Scale, Shapes, Smartphone, Tag, TriangleAlert,
    User, UserX,
} from 'lucide-react';
import {IconPackage, IconTruck} from '@tabler/icons-react';
import {Icon} from '../../icon/Icon';
import type {IconMapEntry} from '../../icon/iconMap';
import {
    fieldIconGutterStyle,
    fieldLabelStyle,
    fieldValueStyle,
} from '../JobDetails.styles';
import classes from './EditableField.module.css';

/**
 * Keys are the AngularJS Material-Symbols names the job-detail field configs
 * still pass; values are their DFRNT (Lucide/Tabler) replacements. Same shape as
 * `iconMap.ts`'s `MUI_ICON_MAP`, whose keys are MUI component names instead.
 */
const FIELD_ICONS: Record<string, IconMapEntry> = {
    person: {lib: 'lucide', component: User},
    phone: {lib: 'lucide', component: Phone},
    phone_android: {lib: 'lucide', component: Smartphone},
    delivery_truck_speed: {lib: 'tabler', component: IconTruck},
    local_shipping: {lib: 'tabler', component: IconTruck},
    schedule: {lib: 'lucide', component: Clock},
    straighten: {lib: 'lucide', component: Ruler},
    scale: {lib: 'lucide', component: Scale},
    qr_code: {lib: 'lucide', component: QrCode},
    warning: {lib: 'lucide', component: TriangleAlert},
    description: {lib: 'lucide', component: FileText},
    package_2: {lib: 'tabler', component: IconPackage},
    inventory_2: {lib: 'tabler', component: IconPackage},
    notifications: {lib: 'lucide', component: Bell},
    email: {lib: 'lucide', component: Mail},
    account_circle: {lib: 'lucide', component: CircleUserRound},
    source: {lib: 'lucide', component: Import},
    contacts: {lib: 'lucide', component: Contact},
    label: {lib: 'lucide', component: Tag},
    speed: {lib: 'lucide', component: Gauge},
    category: {lib: 'lucide', component: Shapes},
    photo_size_select_large: {lib: 'lucide', component: Maximize},
    bookmark: {lib: 'lucide', component: Bookmark},
    // Lucide is a single outline set, so the filled/outline pair collapses to one
    // glyph; the rank/priority pair keeps its distinction through Award.
    bookmark_border: {lib: 'lucide', component: Bookmark},
    ranking: {lib: 'lucide', component: Award},
    tag: {lib: 'lucide', component: Hash},
    badge: {lib: 'lucide', component: IdCard},
    verified: {lib: 'lucide', component: BadgeCheck},
    business: {lib: 'lucide', component: Building2},
    person_off: {lib: 'lucide', component: UserX},
    event: {lib: 'lucide', component: Calendar},
    event_busy: {lib: 'lucide', component: CalendarX},
    event_available: {lib: 'lucide', component: CalendarCheck},
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
    endAdornment?: React.ReactNode;
}

const rowStyle = (dense?: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    textAlign: 'left',
    paddingBlock: dense ? 1 : 4,
    paddingInline: 8,
    minHeight: dense ? 30 : 44,
});

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
    const glyph = icon ? FIELD_ICONS[icon] : undefined;
    const displayValue = value != null && value !== '' ? String(value) : '—';

    // The gutter is dropped entirely in dense mode — at 30px rows there is no
    // vertical space for it.
    const iconElement = !dense && glyph ? (
        <Box style={fieldIconGutterStyle} data-testid="field-icon">
            <Icon {...{[glyph.lib]: glyph.component}} size={18} className={classes.icon} aria-hidden/>
        </Box>
    ) : null;

    const handleToggle = React.useCallback(() => {
        if (onToggleVisibility && fieldKey) {
            (onToggleVisibility as (fieldKey: string) => void)(fieldKey);
        } else if (onToggleVisibility) {
            (onToggleVisibility as () => void)();
        }
    }, [onToggleVisibility, fieldKey]);

    const textBlock = (
        <Box style={{flex: 1, minWidth: 0}}>
            <Text c="dimmed" style={fieldLabelStyle(!!dense)}>{label}</Text>
            <Text truncate style={fieldValueStyle(!!dense)}>{displayValue}</Text>
        </Box>
    );

    // Edit mode: the row picks the field's visibility rather than opening it, so
    // hidden fields stay listed (dimmed) and only the label is shown.
    if (isEditMode) {
        return (
            <Box
                className={classes.row}
                style={{...rowStyle(dense), minHeight: dense ? 36 : 40}}
            >
                <UnstyledButton
                    onClick={handleToggle}
                    style={{flex: 1, minWidth: 0, textAlign: 'left'}}
                >
                    <Text
                        c={isVisible ? undefined : 'dimmed'}
                        style={fieldLabelStyle(false)}
                    >
                        {label}
                    </Text>
                </UnstyledButton>
                {onToggleVisibility && (
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={handleToggle}
                        aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
                    >
                        <Icon lucide={isVisible ? Eye : EyeOff} size={18}/>
                    </ActionIcon>
                )}
            </Box>
        );
    }

    const isClickable = onClick && !disabled;

    return (
        <Collapse expanded={isVisible} keepMounted={false}>
            {isClickable ? (
                <UnstyledButton
                    className={`${classes.row} ${classes.clickable}`}
                    style={rowStyle(dense)}
                    onClick={onClick}
                >
                    {iconElement}
                    {textBlock}
                    {endAdornment}
                </UnstyledButton>
            ) : (
                <Box className={classes.row} style={rowStyle(dense)}>
                    {iconElement}
                    {textBlock}
                    {endAdornment}
                </Box>
            )}
        </Collapse>
    );
});
