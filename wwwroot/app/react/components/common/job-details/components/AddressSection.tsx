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
import {usePendingChangeForField} from '../../../job-change-requests/useJobChangeRequests';
import {PendingChangeBadge} from '../../../job-change-requests/PendingChangeBadge';
import type {JobChangeRequestDto} from '../../../../services/jobChangeRequestApi';
import {AddressType} from '../../../../../enums/address-type.enum';
import {SectionHeader} from './SectionHeader';
import {cardContainerSx} from '../JobDetails.styles';

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
    variant: AddressType;
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
    pendingAddress?: JobChangeRequestDto | null;
    pendingContact?: JobChangeRequestDto | null;
    pendingPhone?: JobChangeRequestDto | null;
}

/* ── Styles ─────────────────────────────────────────────────────── */

const blockSx: SxProps<Theme> = {
    ...cardContainerSx as object,
    flex: 1,
    transition: (theme) => `border-color ${theme.transitions.duration.short}ms ease`,
    '&:hover': {
        borderColor: 'grey.400',
    },
};

const addressDisplaySx: SxProps<Theme> = {
    mx: 1.5,
    mt: 1.5,
    mb: 1,
    p: 1.5,
    borderRadius: 1,
    border: 1,
    borderColor: 'divider',
    bgcolor: 'grey.50',
    transition: (theme) => `all ${theme.transitions.duration.short}ms ease`,
    '&:hover': {
        bgcolor: 'grey.100',
        borderColor: 'grey.400',
    },
};

const contactCardSx: SxProps<Theme> = {
    bgcolor: 'grey.50',
    p: 1.5,
    borderRadius: 1,
    transition: (theme) => `all ${theme.transitions.duration.short}ms ease`,
    border: 1,
    borderColor: 'transparent',
    '&:hover': {
        bgcolor: 'action.selected',
        borderColor: 'grey.400',
    },
};

const contactCardDenseSx: SxProps<Theme> = {...contactCardSx as object, p: 1};

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
                         dense,
                         children,
                     }: {
    icon: React.ComponentType<SvgIconProps>;
    label: string;
    value?: string;
    onClick?: () => void;
    locked?: boolean;
    dense?: boolean;
    children?: React.ReactNode;
}) {
    const card = (
        <Box sx={dense ? contactCardDenseSx : contactCardSx}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25}}>
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
                          dense,
                          pendingAddress,
                          pendingContact,
                          pendingPhone,
                      }: AddressBlockProps) {
    const isPu = variant === AddressType.Pickup;

    return (
        <Box
            sx={{
                ...blockSx as object,
                ...(locked ? {opacity: 0.7, pointerEvents: 'none' as const} : {}),
            } as SxProps<Theme>}
        >
            <SectionHeader
                icon={IconComponent}
                title={title}
                dense={dense}
                variant={isPu ? 'pickup' : 'delivery'}
            />

            {/* Address display */}
            <ButtonBase
                onClick={locked ? undefined : onEditAddress}
                disabled={locked}
                sx={{width: '100%', display: 'block', textAlign: 'left'}}
            >
                <Box sx={dense ? {
                    ...addressDisplaySx as object,
                    mx: 1, mt: 0.75, mb: 0.5, p: 0.75,
                } : addressDisplaySx}>
                    <Typography variant="body2" sx={{fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.6}}>
                        {address?.fullAddress || '\u2014'}
                    </Typography>
                    {pendingAddress && <PendingChangeBadge request={pendingAddress} variant="inline"/>}
                </Box>
            </ButtonBase>

            {/* Contact cards */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: dense ? 0.5 : 1, px: dense ? 1 : 1.5, pb: dense ? 1 : 1.5}}>
                <Box>
                    <ContactCard
                        icon={PersonIcon}
                        label="Contact"
                        value={contactName}
                        onClick={onEditContact}
                        locked={locked}
                        dense={dense}
                    />
                    {pendingContact && (
                        <Box sx={{pl: dense ? 0.5 : 1}}>
                            <PendingChangeBadge request={pendingContact} variant="inline"/>
                        </Box>
                    )}
                </Box>
                {contactPhone != null && (
                    <Box>
                        <ContactCard
                            icon={PhoneIcon}
                            label="Phone"
                            value={contactPhone}
                            onClick={onEditPhone}
                            locked={locked}
                            dense={dense}
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
                        {pendingPhone && (
                            <Box sx={{pl: dense ? 0.5 : 1}}>
                                <PendingChangeBadge request={pendingPhone} variant="inline"/>
                            </Box>
                        )}
                    </Box>
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

    // Partner-job pending-change indicators for address + contact fields.
    // Reads the shared change-request cache; returns null for non-partner
    // jobs and when there's no Pending row.
    const pendingPickupAddress = usePendingChangeForField(job.id, 'PickupAddress');
    const pendingDeliveryAddress = usePendingChangeForField(job.id, 'DeliveryAddress');
    const pendingFromContact = usePendingChangeForField(job.id, 'FromContactName');
    const pendingFromContactPhone = usePendingChangeForField(job.id, 'FromContactPhone');
    const pendingToContact = usePendingChangeForField(job.id, 'ToContactName');
    const pendingToContactPhone = usePendingChangeForField(job.id, 'ToContactPhone');

    return (
        <Box sx={{
            display: 'flex',
            gap: 1,
            flexDirection: {xs: 'column', sm: 'row'},
            alignItems: {xs: 'center', sm: 'stretch'}
        }}>
            <AddressBlock
                title="Pickup"
                variant={AddressType.Pickup}
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
                pendingAddress={pendingPickupAddress}
                pendingContact={pendingFromContact}
                pendingPhone={pendingFromContactPhone}
            />
            <Box sx={flowArrowSx}>
                <ArrowForwardIcon sx={{fontSize: 20, color: 'text.disabled', display: {xs: 'none', sm: 'block'}}}/>
                <ArrowDownwardIcon sx={{fontSize: 20, color: 'text.disabled', display: {xs: 'block', sm: 'none'}}}/>
            </Box>
            <AddressBlock
                title="Delivery"
                variant={AddressType.Delivery}
                icon={addressIcon}
                address={job.deliveryAddress}
                contactName={job.deliverToContact}
                contactPhone={job.toContactPhone}
                onEditAddress={onEditDeliveryAddress}
                onEditContact={onEditToContact}
                onEditPhone={onEditToContactPhone}
                locked={job.locked}
                dense={dense}
                pendingAddress={pendingDeliveryAddress}
                pendingContact={pendingToContact}
                pendingPhone={pendingToContactPhone}
            />
        </Box>
    );
});
