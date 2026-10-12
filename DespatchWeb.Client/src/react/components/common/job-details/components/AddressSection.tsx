/**
 * AddressSection - Pickup + delivery address cards.
 *
 * Matches the AngularJS pattern: two side-by-side bordered cards,
 * each with a colored toolbar header (map-blue for pickup, green for delivery),
 * a bordered address display area with hover, and contact cards.
 */

import React from 'react';
import {ActionIcon, Alert, Badge, Box, Flex, Group, Text, Tooltip, UnstyledButton} from '@mantine/core';
import {ArrowDown, ArrowRight, Phone, PhoneCall, TriangleAlert, User} from 'lucide-react';
import {IconMapPin, IconPlaneDeparture} from '@tabler/icons-react';
import {Icon, type LucideIcon, type TablerIcon} from '../../icon/Icon';
import type {IJob} from '../JobDetails.types';
import {usePendingChangeForField} from '../../../job-change-requests/useJobChangeRequests';
import {PendingChangeBadge} from '../../../job-change-requests/PendingChangeBadge';
import {AddressType} from '../../../../../enums/address-type.enum';
import {SectionHeader} from './SectionHeader';
import {addressesDisagree, STALE_ADDRESS_DETAIL, STALE_ADDRESS_LEAD} from '../../../../utils/addressAgreement';
import type {JobChangeRequestDto} from '../../../../interfaces/jobChangeRequest';
import classes from './AddressSection.module.css';

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
    /** Passed straight to `SectionHeader`'s Tabler slot (place / flight). */
    icon: TablerIcon;
    address?: { fullAddress?: string };
    /** The free-text copy of this address (ucjbToAddr) that the driver app and tracking page read. */
    deviceAddress?: string;
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

/** The card shell. The keyline + its hover live in the CSS module. */
const blockStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 'var(--mantine-radius-lg)',
    backgroundColor: 'var(--dd-surface-container)',
};

const addressDisplayStyle = (dense: boolean): React.CSSProperties => ({
    marginInline: dense ? 8 : 12,
    marginTop: dense ? 6 : 12,
    marginBottom: dense ? 4 : 8,
    padding: dense ? 6 : 12,
    borderRadius: 'var(--mantine-radius-xs)',
});

const contactCardStyle = (dense?: boolean): React.CSSProperties => ({
    padding: dense ? 8 : 12,
    borderRadius: 'var(--mantine-radius-xs)',
});

const contactLabelStyle: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
};

// Truncation is <Text truncate> at the call site, not three properties here.
const contactValueStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    marginTop: 2,
};

/* ── Sub-components ─────────────────────────────────────────────── */

function ContactCard({
    icon,
    label,
    value,
    onClick,
    locked,
    dense,
    children,
}: {
    icon: LucideIcon;
    label: string;
    value?: string;
    onClick?: () => void;
    locked?: boolean;
    dense?: boolean;
    children?: React.ReactNode;
}) {
    const card = (
        <Box className={classes.contact} style={contactCardStyle(dense)}>
            <Group gap={4} mb={2} wrap="nowrap">
                <Icon lucide={icon} size={14} color="var(--mantine-color-dimmed)" aria-hidden/>
                <Text c="dimmed" style={contactLabelStyle}>{label}</Text>
                {children}
            </Group>
            <Text truncate style={contactValueStyle}>
                {value || (
                    <Text component="span" c="dimmed" fs="italic" style={{fontSize: 'inherit'}}>
                        {'—'}
                    </Text>
                )}
            </Text>
        </Box>
    );

    if (onClick && !locked) {
        return (
            <UnstyledButton onClick={onClick} style={{width: '100%', display: 'block', textAlign: 'left'}}>
                {card}
            </UnstyledButton>
        );
    }

    return card;
}

function AddressBlock({
    title,
    variant,
    icon: IconComponent,
    address,
    deviceAddress,
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

    // The two copies of the address are written by different code paths, and an upstream
    // edit that only reaches the free-text one leaves this pane, the grid and the map pin
    // pointing at the previous destination. Say so, and show what the driver is actually
    // working from - re-saving through the address dialog writes both copies.
    const staleAddress = addressesDisagree(deviceAddress, address?.fullAddress);

    return (
        <Box className={classes.block} style={blockStyle}>
            <SectionHeader
                tabler={IconComponent}
                title={title}
                dense={dense}
                variant={isPu ? 'pickup' : 'delivery'}
            />

            {/* Address display — opens the address dialog even when locked; the
                dialog renders read-only. Contact cards below stay non-interactive
                (contact editing is out of the read-only subset). */}
            <UnstyledButton
                onClick={onEditAddress}
                style={{width: '100%', display: 'block', textAlign: 'left'}}
            >
                <Box className={classes.address} style={addressDisplayStyle(dense)}>
                    <Text style={{fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.6}}>
                        {address?.fullAddress || '—'}
                    </Text>
                    {pendingAddress && <PendingChangeBadge request={pendingAddress} variant="inline"/>}
                </Box>
            </UnstyledButton>

            {staleAddress && (
                <Alert
                    role="alert"
                    color="orange"
                    variant="light"
                    icon={<Icon lucide={TriangleAlert} size={16}/>}
                    mx={dense ? 8 : 12}
                    mb={dense ? 4 : 8}
                    p={dense ? 6 : 10}
                    styles={{message: {fontSize: '0.75rem'}}}
                >
                    <Text span fw={600} style={{fontSize: 'inherit'}}>{STALE_ADDRESS_LEAD}{' '}</Text>
                    <Text span style={{fontSize: 'inherit'}}>{deviceAddress}</Text>
                    <Text style={{fontSize: 'inherit', marginTop: 4}}>
                        {STALE_ADDRESS_DETAIL} Open the address to re-enter it.
                    </Text>
                </Alert>
            )}

            {/* Contact cards */}
            <Box
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: dense ? 4 : 8,
                    paddingInline: dense ? 8 : 12,
                    paddingBottom: dense ? 8 : 12,
                }}
            >
                <Box>
                    <ContactCard
                        icon={User}
                        label="Contact"
                        value={contactName}
                        onClick={onEditContact}
                        locked={locked}
                        dense={dense}
                    />
                    {pendingContact && (
                        <Box pl={dense ? 4 : 8}>
                            <PendingChangeBadge request={pendingContact} variant="inline"/>
                        </Box>
                    )}
                </Box>
                {contactPhone != null && (
                    <Box>
                        <ContactCard
                            icon={Phone}
                            label="Phone"
                            value={contactPhone}
                            onClick={onEditPhone}
                            locked={locked}
                            dense={dense}
                        >
                            {phoneSource && (
                                <Badge size="sm" variant="default" tt="none" ml={4} style={{height: 20, fontSize: '0.6875rem'}}>
                                    {phoneSource}
                                </Badge>
                            )}
                            {contactPhone && (
                                <Tooltip label={`Call ${contactPhone}`}>
                                    <ActionIcon
                                        size="sm"
                                        variant="subtle"
                                        component="a"
                                        href={`tel:${contactPhone}`}
                                        aria-label={`Call ${contactPhone}`}
                                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                        ml="auto"
                                    >
                                        <Icon lucide={PhoneCall} size={14} color="var(--mantine-primary-color-filled)"/>
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </ContactCard>
                        {pendingPhone && (
                            <Box pl={dense ? 4 : 8}>
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
    const addressIcon = job.isFlightAssigned ? IconPlaneDeparture : IconMapPin;

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
        <Flex
            gap="xs"
            direction={{base: 'column', sm: 'row'}}
            align={{base: 'center', sm: 'stretch'}}
        >
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
            {/* The flow arrow turns with the layout: across on a wide card, down
                once the two blocks stack. */}
            <Box style={{display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                <Box visibleFrom="sm">
                    <Icon lucide={ArrowRight} size={20} color="var(--mantine-color-dimmed)" aria-hidden/>
                </Box>
                <Box hiddenFrom="sm">
                    <Icon lucide={ArrowDown} size={20} color="var(--mantine-color-dimmed)" aria-hidden/>
                </Box>
            </Box>
            <AddressBlock
                title="Delivery"
                variant={AddressType.Delivery}
                icon={addressIcon}
                address={job.deliveryAddress}
                deviceAddress={job.toAddress}
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
        </Flex>
    );
});
