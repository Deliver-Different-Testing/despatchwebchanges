import React, { useState, useCallback } from 'react';
import {
    ActionIcon, Alert, Badge, Box, Group, Loader, Paper, Stack, Text, Tooltip, alpha, useMantineTheme,
} from '@mantine/core';
import { Bug, ClipboardList, Info, LocateFixed, User } from 'lucide-react';
import { IconMap } from '@tabler/icons-react';
import { Icon } from '../icon/Icon';
import { DialogHeader, DialogShell } from '../../dialogs/shared/mantine';
import { dialogContentBg } from '../../dialogs/shared/mantine/styles';
import type { IClearListDebugViewModel } from '../../../../interfaces/job.interface';
import { apiClient } from '../../../services/apiClient';

async function fetchClearListDebug(courierId: number): Promise<IClearListDebugViewModel> {
    return apiClient.get<IClearListDebugViewModel>('/courier/ClearListDebug', { courierId });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <Group gap={8} py={4} align="flex-start" wrap="nowrap">
            <Text
                fz="xs"
                c="dimmed"
                tt="uppercase"
                fw={500}
                miw={160}
                pt={2}
                style={{ letterSpacing: 0.5 }}
            >
                {label}
            </Text>
            <Box style={{ flex: 1 }}>
                {value ?? (
                    <Text component="span" fz="sm" c="var(--mantine-color-dimmed)">
                        N/A
                    </Text>
                )}
            </Box>
        </Group>
    );
}

export function ClearListDebugButton({ courierId }: { courierId: number }) {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<IClearListDebugViewModel | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleOpen = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen(true);
        setLoading(true);
        setError(null);
        try {
            const result = await fetchClearListDebug(courierId);
            setData(result);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load debug info');
        } finally {
            setLoading(false);
        }
    }, [courierId]);

    const handleClose = useCallback(() => {
        setOpen(false);
    }, []);

    return (
        <>
            <Tooltip label="Clear list debug info">
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={handleOpen}
                    aria-label="Clear list debug info"
                >
                    <Icon lucide={Info} size={14} />
                </ActionIcon>
            </Tooltip>
            <DialogShell opened={open} onClose={handleClose} label="Clear List Debug">
                <DialogHeader
                    icon={<Icon lucide={Bug} />}
                    title="Clear List Debug"
                    subtitle="Driver placement diagnostics"
                    onClose={handleClose}
                />
                <Box bg={dialogContentBg}>
                    {loading && (
                        <Group justify="center" py={64}>
                            <Loader size={40} role="progressbar" aria-label="Loading debug info" />
                        </Group>
                    )}
                    {error && (
                        <Box p={24}>
                            <Alert color="red">{error}</Alert>
                        </Box>
                    )}
                    {data && !loading && <DebugContent data={data} />}
                </Box>
            </DialogShell>
        </>
    );
}

function SectionCard({
    icon,
    title,
    color,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    /** A Mantine colour name — tints the section's header strip. */
    color: string;
    children: React.ReactNode;
}) {
    const theme = useMantineTheme();
    const ramp = theme.colors[color] ?? theme.colors[theme.primaryColor];

    return (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
            <Group
                px={20}
                py={16}
                gap={12}
                wrap="nowrap"
                style={{
                    backgroundColor: alpha(ramp[5], 0.04),
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                }}
            >
                {icon}
                <Text fz="md" fw={600}>
                    {title}
                </Text>
            </Group>
            <Box p={20}>{children}</Box>
        </Paper>
    );
}

function DebugContent({ data }: { data: IClearListDebugViewModel }) {
    const theme = useMantineTheme();
    const gpsStale = data.gpsAgeMinutes != null && data.gpsAgeMinutes > 3;

    return (
        <Stack p={24} gap={24}>
            {/* Explanation */}
            <Alert color="blue" icon={<Icon lucide={Info} />}>
                <Text fz="sm">{data.explanation}</Text>
            </Alert>

            {/* Courier Info */}
            <SectionCard
                icon={<Icon lucide={User} size={22} color="var(--mantine-primary-color-filled)" />}
                title="Courier"
                color={theme.primaryColor}
            >
                <InfoRow label="Code" value={data.courierCode} />
                <InfoRow label="Name" value={data.courierName} />
                <InfoRow label="Channel ID" value={data.channelId} />
                <InfoRow label="Fleet" value={data.fleetName} />
                <InfoRow
                    label="Logged In"
                    value={
                        data.isLoggedIn
                            ? <Badge size="sm" color="green" variant="light">Yes</Badge>
                            : <Badge size="sm" color="gray" variant="light">No</Badge>
                    }
                />
                {data.loginTime && <InfoRow label="Login Time" value={data.loginTime} />}
            </SectionCard>

            {/* GPS Info */}
            <SectionCard
                icon={<Icon lucide={LocateFixed} size={22} color="var(--mantine-color-green-6)" />}
                title="GPS Location"
                color="green"
            >
                <InfoRow label="Polygon ID" value={data.gpsPolygonId} />
                <InfoRow label="Polygon Name" value={data.gpsPolygonName} />
                {data.gpsPolygonSuburbs.length > 0 && (
                    <InfoRow
                        label="Suburbs in Polygon"
                        value={
                            <Group gap={4} wrap="wrap">
                                {data.gpsPolygonSuburbs.map(s => (
                                    <Badge key={s} size="sm" color="gray" variant="light">{s}</Badge>
                                ))}
                            </Group>
                        }
                    />
                )}
                <InfoRow
                    label="Lat/Lng"
                    value={data.gpsLatitude != null ? `${data.gpsLatitude}, ${data.gpsLongitude}` : null}
                />
                <InfoRow
                    label="GPS Age"
                    value={
                        data.gpsAgeMinutes != null
                            ? (
                                <Badge size="sm" variant="light" color={gpsStale ? 'orange' : 'green'}>
                                    {`${data.gpsAgeMinutes} min ago`}
                                </Badge>
                            )
                            : null
                    }
                />
                {data.gpsTimestamp && <InfoRow label="GPS Timestamp" value={data.gpsTimestamp} />}
            </SectionCard>

            {/* Admin Assignment */}
            <SectionCard
                icon={<Icon lucide={ClipboardList} size={22} color="var(--mantine-color-reflex-6)" />}
                title="Admin Assignment (TblClearListAreaOrder)"
                color="reflex"
            >
                <InfoRow label="Assigned Area" value={data.assignedClearListAreaName} />
                <InfoRow label="Status" value={data.assignedStatusLabel} />
                <Text fz="xs" c="dimmed">
                    This controls the row position (top/middle/bottom), NOT which area column the driver appears in.
                </Text>
            </SectionCard>

            {/* Polygon-to-Area Mappings */}
            <SectionCard
                icon={<Icon tabler={IconMap} size={22} color="var(--mantine-color-orange-6)" />}
                title="Polygon Area Mappings"
                color="orange"
            >
                <Text fz="xs" c="dimmed" display="block" mb={12}>
                    Which clear list areas this courier&apos;s GPS polygon is linked to. The driver appears in areas
                    where the channel matches.
                </Text>
                {data.polygonAreaMappings.length === 0 ? (
                    <Alert color="orange">
                        No polygon-to-area mappings found. This driver&apos;s GPS polygon is not linked to any clear
                        list area.
                    </Alert>
                ) : (
                    <Stack gap={4}>
                        {data.polygonAreaMappings.map(m => (
                            <Group
                                key={m.clearListAreaId}
                                gap={8}
                                p={8}
                                wrap="nowrap"
                                style={{
                                    borderRadius: 'var(--mantine-radius-sm)',
                                    border: `1px solid ${m.channelMatches
                                        ? theme.colors.green[3]
                                        : 'var(--mantine-color-default-border)'}`,
                                    backgroundColor: m.channelMatches
                                        ? alpha(theme.colors.green[5], 0.06)
                                        : 'var(--mantine-color-gray-1)',
                                }}
                            >
                                <Text fz="sm" fw={600}>{m.clearListAreaName}</Text>
                                <Badge size="sm" color="gray" variant="light">{`Ch: ${m.areaChannelId}`}</Badge>
                                <Badge
                                    size="sm"
                                    variant="light"
                                    color={m.channelMatches ? 'green' : 'gray'}
                                >
                                    {m.channelMatches ? 'Channel Match' : 'No Match'}
                                </Badge>
                            </Group>
                        ))}
                    </Stack>
                )}
            </SectionCard>
        </Stack>
    );
}
