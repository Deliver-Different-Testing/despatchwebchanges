/**
 * AddressSection - Pickup + delivery address cards.
 *
 * Matches the AngularJS pattern: two side-by-side bordered cards,
 * each with a colored toolbar header (primary for pickup, green for delivery),
 * a bordered address display area with hover, and contact cards.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import type {SxProps, Theme} from '@mui/material/styles';
import type {SvgIconProps} from '@mui/material/SvgIcon';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import CallIcon from '@mui/icons-material/Call';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import PlaceIcon from '@mui/icons-material/Place';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import Chip from '@mui/material/Chip';
import type {IJob} from '../JobDetails.types';

type AddressVariant = 'pickup' | 'delivery';

interface AddressSectionProps {
    job: IJob;
    dense: boolean;
    onEditPickupAddress: () => void;
    onEditDeliveryAddress: () => void;
    onEditFromContact: () => void;
    onEditToContact: () => void;
    onEditFromContactPhone: () => void;
    onEditToContactPhone: () => void;
}

interface AddressBlockProps {
    title: string;
    variant: AddressVariant;
    icon: React.ComponentType<SvgIconProps>;
    address?: { fullAddress?: string };
    contactName?: string;
    contactPhone?: string;
    phoneSource?: string;
    onEditAddress: () => void;
    onEditContact: () => void;
    onEditPhone: () => void;
    locked?: boolean;
    dense: boolean;
}

/* ── Styles ─────────────────────────────────────────────────────── */

const blockSx: SxProps<Theme> = {
    flex: 1,
    bgcolor: 'background.paper',
    borderRadius: 2,
    overflow: 'hidden',
    border: 1,
    borderColor: 'divider',
    transition: (theme) => `all ${theme.transitions.duration.short}ms ease`,
    '&:hover': {
        borderColor: 'grey.400',
    },
};

const addressDisplaySx: SxProps<Theme> = {
    mx: 1.5,
    mt: 1.5,
    mb: 1,
    p: 1,
    borderRadius: 1,
    border: 1,
    borderColor: 'divider',
    bgcolor: 'grey.50',
    transition: (theme) => `all ${theme.transitions.duration.short}ms ease`,
    '&:hover': {
        bgcolor: 'grey.100',
        borderColor: 'primary.main',
    },
};

const contactCardSx: SxProps<Theme> = {
    bgcolor: 'grey.50',
    p: 1,
    borderRadius: 1,
    transition: (theme) => `all ${theme.transitions.duration.short}ms ease`,
    border: 1,
    borderColor: 'transparent',
    '&:hover': {
        bgcolor: 'action.selected',
        borderColor: 'primary.main',
    },
};

const contactLabelSx: SxProps<Theme> = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
};

const contactValueSx: SxProps<Theme> = {
    fontSize: '0.8125rem',
    mt: 0.25,
};

/* ── Sub-components ─────────────────────────────────────────────── */

function ContactCard({
                         icon: IconComp,
                         label,
                         value,
                         onClick,
                         locked,
                         children,
                     }: {
    icon: React.ComponentType<SvgIconProps>;
    label: string;
    value?: string;
    onClick?: () => void;
    locked?: boolean;
    children?: React.ReactNode;
}) {
    const card = (
        <Box sx={contactCardSx}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5}}>
                <IconComp sx={{fontSize: 14, color: 'text.secondary'}}/>
                <Typography variant="caption" color="text.secondary" sx={contactLabelSx}>
                    {label}
                </Typography>
                {children}
            </Box>
            <Typography variant="body2" noWrap sx={contactValueSx}>
                {value || <Typography component="span" sx={{
                    fontStyle: 'italic',
                    color: 'text.disabled',
                    fontSize: 'inherit'
                }}>{'\u2014'}</Typography>}
            </Typography>
        </Box>
    );

    if (onClick && !locked) {
        return (
            <ButtonBase
                onClick={onClick}
                sx={{borderRadius: 1, width: '100%', textAlign: 'left', display: 'block'}}
            >
                {card}
            </ButtonBase>
        );
    }

    return card;
}

function AddressBlock({
                          title,
                          variant,
                          icon: IconComponent,
                          address,
                          contactName,
                          contactPhone,
                          phoneSource,
                          onEditAddress,
                          onEditContact,
                          onEditPhone,
                          locked,
                      }: AddressBlockProps) {
    const isPu = variant === 'pickup';

    const toolbarBg = isPu
        ? 'linear-gradient(135deg, var(--pickup-color) 0%, var(--pickup-color-dark) 100%)'
        : 'linear-gradient(135deg, var(--delivery-color) 0%, var(--delivery-color-dark) 100%)';

    return (
        <Box
            sx={{
                ...blockSx as object,
                ...(locked ? {opacity: 0.7, pointerEvents: 'none' as const} : {}),
                // CSS custom properties for toolbar gradient
                '--pickup-color': (theme: Theme) => theme.palette.primary.main,
                '--pickup-color-dark': (theme: Theme) => theme.palette.primary.dark,
                '--delivery-color': (theme: Theme) => theme.palette.success.main,
                '--delivery-color-dark': (theme: Theme) => theme.palette.success.dark,
            } as SxProps<Theme>}
        >
            {/* Coloured toolbar */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    height: 40,
                    minHeight: 40,
                    background: toolbarBg,
                    color: 'common.white',
                }}
            >
                <IconComponent sx={{fontSize: 18, color: 'common.white'}}/>
                <Typography variant="subtitle2" sx={{fontSize: '0.8125rem', fontWeight: 600, color: 'inherit'}}>
                    {title}
                </Typography>
            </Box>

            {/* Address display */}
            <ButtonBase
                onClick={locked ? undefined : onEditAddress}
                disabled={locked}
                sx={{width: '100%', display: 'block', textAlign: 'left'}}
            >
                <Box sx={addressDisplaySx}>
                    <Typography variant="body2" sx={{fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.6}}>
                        {address?.fullAddress || '\u2014'}
                    </Typography>
                </Box>
            </ButtonBase>

            {/* Contact cards */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 1, px: 1.5, pb: 1.5}}>
                <ContactCard
                    icon={PersonIcon}
                    label="Contact"
                    value={contactName}
                    onClick={onEditContact}
                    locked={locked}
                />
                {contactPhone != null && (
                    <ContactCard
                        icon={PhoneIcon}
                        label="Phone"
                        value={contactPhone}
                        onClick={onEditPhone}
                        locked={locked}
                    >
                        {phoneSource && (
                            <Chip label={phoneSource} size="small" variant="outlined"
                                  sx={{height: 20, fontSize: '0.6875rem', ml: 0.5}}/>
                        )}
                        {contactPhone && (
                            <Tooltip title={`Call ${contactPhone}`}>
                                <IconButton
                                    size="small"
                                    component="a"
                                    href={`tel:${contactPhone}`}
                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                    sx={{p: 0.25, ml: 'auto'}}
                                >
                                    <CallIcon sx={{fontSize: 14, color: 'primary.main'}}/>
                                </IconButton>
                            </Tooltip>
                        )}
                    </ContactCard>
                )}
            </Box>
        </Box>
    );
}

/* ── Main export ────────────────────────────────────────────────── */

const flowArrowSx: SxProps<Theme> = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
};

export const AddressSection = React.memo(({
                                              job,
                                              dense,
                                              onEditPickupAddress,
                                              onEditDeliveryAddress,
                                              onEditFromContact,
                                              onEditToContact,
                                              onEditFromContactPhone,
                                              onEditToContactPhone,
                                          }: AddressSectionProps) => {
    const addressIcon = job.isFlightAssigned ? FlightTakeoffIcon : PlaceIcon;

    return (
        <Box sx={{
            display: 'flex',
            gap: 1,
            flexDirection: {xs: 'column', sm: 'row'},
            alignItems: {xs: 'center', sm: 'stretch'}
        }}>
            <AddressBlock
                title="Pickup"
                variant="pickup"
                icon={addressIcon}
                address={job.pickupAddress}
                contactName={job.fromContactName}
                contactPhone={job.fromContactNumber}
                phoneSource={job.fromContactNumberSource}
                onEditAddress={onEditPickupAddress}
                onEditContact={onEditFromContact}
                onEditPhone={onEditFromContactPhone}
                locked={job.locked}
                dense={dense}
            />
            <Box sx={flowArrowSx}>
                <ArrowForwardIcon sx={{fontSize: 20, color: 'text.disabled', display: {xs: 'none', sm: 'block'}}}/>
                <ArrowDownwardIcon sx={{fontSize: 20, color: 'text.disabled', display: {xs: 'block', sm: 'none'}}}/>
            </Box>
            <AddressBlock
                title="Delivery"
                variant="delivery"
                icon={addressIcon}
                address={job.deliveryAddress}
                contactName={job.deliverToContact}
                contactPhone={job.toContactPhone}
                onEditAddress={onEditDeliveryAddress}
                onEditContact={onEditToContact}
                onEditPhone={onEditToContactPhone}
                locked={job.locked}
                dense={dense}
            />
        </Box>
    );
});
