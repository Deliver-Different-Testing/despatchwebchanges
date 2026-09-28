/**
 * React Agent Info Dialog
 *
 * A modern replacement for the AngularJS agent-info-dialog.
 * Displays comprehensive information about a dispatch agent including:
 * - Basic info (name, rate, ranking, contact)
 * - Address
 * - Notes
 * - Assigned airports with details
 */

import React from 'react';
import {alpha, Anchor, Badge, Box, Divider, em, Flex, Group, Loader, Paper, Rating, SimpleGrid, Stack, Text, ThemeIcon} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {Clock, Crosshair, HardHat, Mail, Phone} from 'lucide-react';
import {IconMapPin, IconPlane, IconPlaneOff} from '@tabler/icons-react';
import {formatCurrency} from '../../../utils/currencyUtils';
import {Icon} from '../../common/icon/Icon';
import {AddressViewModel, AgentInfo, AirportViewModel} from '../../../interfaces';
import {
    dialogContentBg,
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogSize,
    sectionLabelProps,
    sectionPaperProps,
} from '../shared/mantine';
import {AgentInfoDialogProps} from "./AgentInfoDialogProps";

// Re-export interfaces for backward compatibility
export type {AgentInfo, AirportViewModel, AddressViewModel};

const DIALOG_TITLE = 'Agent Details';
const AIRPORT_LIST_MAX_HEIGHT = 420;

// Helper functions
function formatPhone(phone: string | undefined): string {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
    }
    return phone;
}

function getRankingValue(ranking: string | undefined): number {
    if (!ranking) return 0;
    const rankNum = parseFloat(ranking);
    if (isNaN(rankNum)) return 0;
    return Math.round(rankNum);
}

function formatCoordinates(lat: number | undefined, lng: number | undefined): string {
    if (lat === undefined || lng === undefined) return '';
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

function formatCurrencyOrEmpty(value: number | undefined): string {
    if (value === undefined) return '';
    return formatCurrency(value);
}

export const AgentInfoDialog: React.FC<AgentInfoDialogProps> = ({open, agent, isLoading, onClose}) => {
    /*
     * Matches the MUI `breakpoints.down('sm')` this replaced (<600px). Also drives
     * the two-column layout below, rather than `direction={{base, sm}}`: the query
     * already exists for the Modal's `fullScreen` prop, and Mantine's `sm` is 768px
     * against this dialog's 600px, so responsive props would add a 2nd breakpoint.
     */
    const fullScreen = useMediaQuery(`(max-width: ${em(600)})`) ?? false;
    const rankingValue = getRankingValue(agent?.agentRanking);

    return (
        <DialogShell
            opened={open}
            onClose={onClose}
            size={dialogSize.md}
            fullScreen={fullScreen}
            label={DIALOG_TITLE}
        >
            <DialogHeader
                icon={<Icon lucide={HardHat}/>}
                title={DIALOG_TITLE}
                subtitle={agent?.agentName}
                onClose={onClose}
            />
            {/* Content */}
            <Box style={{backgroundColor: dialogContentBg}}>
                {isLoading ? (
                    <Group justify="center" py={64}>
                        {/* Mantine's Loader carries no implicit role. */}
                        <Loader size={40} role="progressbar" aria-label="Loading agent"/>
                    </Group>
                ) : agent ? (
                    <Flex p="lg" gap="lg" direction={fullScreen ? 'column' : 'row'}>
                        {/* Left Column - Agent Details */}
                        <Stack gap="lg" style={{flex: '1 1 60%', minWidth: 0}}>
                            {/* Basic Information */}
                            <Box>
                                <Text {...sectionLabelProps}>Basic Information</Text>
                                <Paper {...sectionPaperProps}>
                                    <SimpleGrid cols={fullScreen ? 1 : 2} spacing="lg">
                                    <InfoField label="Name" value={agent.agentName}/>

                                    <InfoField
                                        label="Rate"
                                        value={formatCurrencyOrEmpty(agent.agentRate)}
                                        valueColor="green.6"
                                        valueFontWeight={600}
                                    />

                                    {/* Ranking */}
                                    <Box>
                                        <FieldLabel>Ranking</FieldLabel>
                                        {rankingValue > 0 ? (
                                            <Rating
                                                value={rankingValue}
                                                count={5}
                                                fractions={1}
                                                readOnly
                                                size="sm"
                                                aria-label={`Ranking: ${rankingValue} out of 5`}
                                            />
                                        ) : (
                                            <Text size="sm" c="dimmed">No ranking</Text>
                                        )}
                                    </Box>

                                    {/* Phone */}
                                    <Box>
                                        <FieldLabel>Phone</FieldLabel>
                                        {agent.agentPhone ? (
                                            <Anchor href={`tel:${agent.agentPhone}`} underline="hover">
                                                <Group gap={6} wrap="nowrap" component="span">
                                                    <Icon lucide={Phone} size={16}/>
                                                    <Text size="sm" component="span">{formatPhone(agent.agentPhone)}</Text>
                                                </Group>
                                            </Anchor>
                                        ) : (
                                            <Text size="sm" c="dimmed">Not provided</Text>
                                        )}
                                    </Box>

                                    {/* Email */}
                                    <Box style={{gridColumn: fullScreen ? undefined : '1 / -1'}}>
                                        <FieldLabel>Email</FieldLabel>
                                        {agent.agentEmail ? (
                                            <Anchor href={`mailto:${agent.agentEmail}`} underline="hover">
                                                <Group gap={6} wrap="nowrap" component="span">
                                                    <Icon lucide={Mail} size={16}/>
                                                    <Text size="sm" component="span">{agent.agentEmail}</Text>
                                                </Group>
                                            </Anchor>
                                        ) : (
                                            <Text size="sm" c="dimmed">Not provided</Text>
                                        )}
                                    </Box>

                                    {/* Address */}
                                    <Box style={{gridColumn: '1 / -1'}}>
                                        <FieldLabel>Address</FieldLabel>
                                        <Group gap={6} align="flex-start" wrap="nowrap">
                                            <Box c="dimmed" mt={2}>
                                                <Icon tabler={IconMapPin} size={16}/>
                                            </Box>
                                            <Text size="sm">
                                                {agent.address?.fullAddress || 'No address available'}
                                            </Text>
                                        </Group>
                                        </Box>
                                    </SimpleGrid>
                                </Paper>
                            </Box>

                            {/* Notes */}
                            <Box>
                                <Text {...sectionLabelProps}>Notes</Text>
                                <Paper {...sectionPaperProps}>
                                    <Text
                                        size="sm"
                                        c={agent.agentNotes ? undefined : 'dimmed'}
                                        fs={agent.agentNotes ? undefined : 'italic'}
                                        style={{whiteSpace: 'pre-line', lineHeight: 1.7}}
                                    >
                                        {agent.agentNotes || 'No notes available.'}
                                    </Text>
                                </Paper>
                            </Box>
                        </Stack>

                        {/* Right Column - Airports */}
                        <Box style={{flex: '1 1 40%', minWidth: 0}}>
                            <Group gap="xs" mb="xs" wrap="nowrap">
                                <Box c="green.6" style={{display: 'flex'}}>
                                    <Icon tabler={IconPlane} size={18}/>
                                </Box>
                                <Text size="sm" c="dimmed" fw={500}>Assigned Airports</Text>
                                {agent.airports && agent.airports.length > 0 && (
                                    <Badge color="green" size="sm" ml="auto" fw={600}>
                                        {agent.airports.length}
                                    </Badge>
                                )}
                            </Group>
                            <Paper {...sectionPaperProps} p={0} style={{overflow: 'hidden'}}>
                                {agent.airports && agent.airports.length > 0 ? (
                                    <Box
                                        role="region"
                                        aria-label="Assigned airports"
                                        tabIndex={0}
                                        style={{maxHeight: AIRPORT_LIST_MAX_HEIGHT, overflowY: 'auto'}}
                                    >
                                        {agent.airports.map((airport: AirportViewModel, index: number) => (
                                            <React.Fragment key={airport.code || index}>
                                                {index > 0 && <Divider/>}
                                                <Box p="md">
                                                <Group gap="sm" wrap="nowrap" mb="xs">
                                                    <Badge size="sm" fw={700} style={{letterSpacing: 0.5}}>
                                                        {airport.code}
                                                    </Badge>
                                                    <Text size="sm" fw={500} truncate style={{flex: 1}}>
                                                        {airport.name}
                                                    </Text>
                                                </Group>

                                                <Stack gap={4} pl={4}>
                                                    <AirportDetail icon={<Icon tabler={IconMapPin} size={14}/>}>
                                                        {airport.city}, {airport.country}
                                                    </AirportDetail>
                                                    <AirportDetail icon={<Icon lucide={Clock} size={14}/>}>
                                                        {airport.timezone}
                                                    </AirportDetail>
                                                    <AirportDetail icon={<Icon lucide={Crosshair} size={14}/>}>
                                                        {formatCoordinates(airport.latitude, airport.longitude)}
                                                    </AirportDetail>
                                                </Stack>
                                                </Box>
                                            </React.Fragment>
                                        ))}
                                    </Box>
                                ) : (
                                    <Stack align="center" justify="center" py={48} px="md" gap={0}>
                                            {/* An empty-state glyph in a tinted disc is `ThemeIcon variant="light"`. */}
                                            <ThemeIcon size={64} radius="xl" variant="light" color="gray" mb="md">
                                                <Icon tabler={IconPlaneOff} size={32}/>
                                            </ThemeIcon>
                                        <Text size="sm" c="dimmed" fs="italic">No airports assigned</Text>
                                    </Stack>
                                )}
                            </Paper>
                        </Box>
                    </Flex>
                ) : (
                    <Group justify="center" py={64}>
                        <Text c="dimmed">No agent data available</Text>
                    </Group>
                )}
            </Box>
            {!isLoading && (
                <DialogFooter onCancel={onClose} cancelLabel="Close" hideConfirm/>
            )}
        </DialogShell>
    );
};

// A single icon + caption row in an airport card
function AirportDetail({icon, children}: {icon: React.ReactNode; children: React.ReactNode}): React.ReactElement {
    return (
        <Group gap={6} wrap="nowrap" c="dimmed">
            <Box style={{display: 'flex'}}>{icon}</Box>
            <Text size="xs">{children}</Text>
        </Group>
    );
}

// Field label shared by the basic-info grid cells
function FieldLabel({children}: {children: React.ReactNode}): React.ReactElement {
    return (
        <Text
            size="xs"
            c="dimmed"
            fw={500}
            tt="uppercase"
            mb={6}
            display="block"
            style={{letterSpacing: 0.5}}
        >
            {children}
        </Text>
    );
}

// Helper component for info fields
interface InfoFieldProps {
    label: string;
    value: string;
    valueColor?: string;
    valueFontWeight?: number;
}

function InfoField({label, value, valueColor, valueFontWeight}: InfoFieldProps): React.ReactElement {
    return (
        <Box>
            <FieldLabel>{label}</FieldLabel>
            <Text size="sm" c={valueColor} fw={valueFontWeight || 400}>
                {value || 'Not provided'}
            </Text>
        </Box>
    );
}

export default AgentInfoDialog;
