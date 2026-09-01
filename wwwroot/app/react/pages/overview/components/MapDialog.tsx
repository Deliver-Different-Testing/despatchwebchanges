import React, {useState, useEffect, useMemo} from 'react';
import {Box, Group, Loader, Stack, Text} from '@mantine/core';
import {Map as MapGlyph} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../../../query';
import {overviewApi} from '../../../services/overviewApi';
import {configApi} from '../../../services/configApi';
import {SymbolIcon} from '../../../components/common/symbol-icon';
import {HereMap} from '../../../components/common/here-map/HereMap';
import type {HereMapCredentials, HereMapConfig} from '../../../components/common/here-map/HereMap.types';
import type {OverviewTableParentJob} from '../OverviewPage.interfaces';
import {DialogHeader, DialogShell} from '../../../components/dialogs/shared/mantine';

interface MapDialogProps {
    open: boolean;
    onClose: () => void;
    delivery: OverviewTableParentJob | null;
}

export const MapDialog: React.FC<MapDialogProps> = ({open, onClose, delivery}) => {
    const [selectedJobIndex, setSelectedJobIndex] = useState(0);

    // Reset selected job when delivery changes
    useEffect(() => {
        setSelectedJobIndex(0);
    }, [delivery?.jobId]);

    // Fetch HERE Maps API key
    const {data: apiKey} = useQuery({
        queryKey: queryKeys.hereMaps.apiKey,
        queryFn: () => configApi.getHereMapsKey(),
        staleTime: 10 * 60 * 1000,
        enabled: open,
    });

    // Fetch map data for the job
    const {data: mapConfig, isLoading} = useQuery({
        queryKey: queryKeys.overview.parentJobMap(delivery?.jobId ?? 0),
        queryFn: ({signal}) => overviewApi.getParentJobMap(delivery!.jobId, {signal}),
        enabled: open && delivery != null,
    });

    const credentials: HereMapCredentials | undefined = apiKey ? {apiKey} : undefined;

    // Build the HERE map config, updating selectedJobIndex
    const hereMapConfig: HereMapConfig | undefined = useMemo(() => {
        if (!mapConfig) return undefined;
        return {
            ...mapConfig,
            selectedJobIndex,
        } as unknown as HereMapConfig;
    }, [mapConfig, selectedJobIndex]);

    const childJobs = delivery?.childJobs ?? [];

    return (
        // The bespoke header built from the legacy sx tokens is now the shared
        // DialogHeader, which is the same design language with the close button,
        // on-colour and hover already correct.
        <DialogShell
            opened={open}
            onClose={onClose}
            size="90%"
            label={`${delivery?.jobName ?? ''} Map`}
            styles={{content: {height: '80vh'}}}
        >
            <DialogHeader
                icon={<Icon lucide={MapGlyph}/>}
                title={`${delivery?.jobName} Map`}
                subtitle="View delivery locations and routes"
                onClose={onClose}
            />
            <Box style={{flex: 1, position: 'relative', overflow: 'hidden'}}>
                {isLoading && (
                    <Stack
                        align="center"
                        justify="center"
                        gap={16}
                        style={{position: 'absolute', inset: 0, zIndex: 10}}
                    >
                        <Loader size={60} role="progressbar" aria-label="Loading map data"/>
                        <Text fz="sm">Loading map data...</Text>
                    </Stack>
                )}

                {/* isolation: isolate traps HERE's internal z-index (~1001) below the
                    timeline overlay — inline so it stays assertable with toHaveStyle. */}
                {!isLoading && credentials && hereMapConfig && (
                    <Box style={{width: '100%', height: '100%', position: 'relative', isolation: 'isolate'}}>
                        <HereMap
                            mapId="overviewMapContainer"
                            credentials={credentials}
                            config={hereMapConfig}
                        />

                        {/* Timeline Navigation Overlay */}
                        <Box
                            p={12}
                            maw="90%"
                            style={{
                                position: 'absolute',
                                bottom: 16,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: 'rgba(255,255,255,0.95)',
                                borderRadius: 8,
                                boxShadow: 'var(--mantine-shadow-md)',
                                overflowX: 'auto',
                            }}
                        >
                            <Group gap={4} mb={8} wrap="nowrap">
                                <SymbolIcon name="timeline" size={16} />
                                <Text fz="xs" fw={600}>
                                    Delivery Route
                                </Text>
                            </Group>

                            <Group gap={0} align="center" wrap="nowrap">
                                {/* Parent Node */}
                                <TimelineNode
                                    active={selectedJobIndex === 0}
                                    onClick={() => setSelectedJobIndex(0)}
                                    icon="flag"
                                    labelType="Origin"
                                    labelName={delivery?.jobName}
                                />

                                <TimelineConnection />

                                {/* Child Nodes */}
                                {childJobs.map((child, idx) => (
                                    <React.Fragment key={child.jobId}>
                                        <TimelineNode
                                            active={selectedJobIndex === idx + 1}
                                            onClick={() => setSelectedJobIndex(idx + 1)}
                                            number={idx + 1}
                                            labelType={`Stop ${idx + 1}`}
                                            labelName={child.jobName}
                                        />
                                        {idx < childJobs.length - 1 && <TimelineConnection />}
                                    </React.Fragment>
                                ))}

                                {/* End Node */}
                                {childJobs.length > 0 && (
                                    <>
                                        <TimelineConnection />
                                        <TimelineNode
                                            active={selectedJobIndex === childJobs.length + 1}
                                            onClick={() => setSelectedJobIndex(childJobs.length + 1)}
                                            icon="place"
                                            labelType="Destination"
                                        />
                                    </>
                                )}
                            </Group>
                        </Box>
                    </Box>
                )}
            </Box>
        </DialogShell>
    );
};

// ── Timeline sub-components ──

const TimelineNode: React.FC<{
    active: boolean;
    onClick: () => void;
    icon?: string;
    number?: number;
    labelType: string;
    labelName?: string;
}> = ({active, onClick, icon, number, labelType, labelName}) => (
    <Stack align="center" gap={0} miw={60} onClick={onClick} style={{cursor: 'pointer'}}>
        <Group
            w={32}
            h={32}
            justify="center"
            align="center"
            gap={0}
            fw={600}
            fz="0.75rem"
            bg={active ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-gray-3)'}
            c={active ? 'var(--mantine-primary-color-contrast)' : 'dimmed'}
            style={{borderRadius: '50%', transition: 'all 0.2s'}}
        >
            {icon ? (
                <SymbolIcon name={icon} size={18} />
            ) : (
                number
            )}
        </Group>
        <Text
            fz="0.6rem"
            mt={2}
            fw={active ? 600 : 400}
            c={active ? 'var(--mantine-primary-color-filled)' : 'dimmed'}
        >
            {labelType}
        </Text>
        {labelName && (
            <Text fz="0.55rem" maw={70} ta="center" truncate>
                {labelName}
            </Text>
        )}
    </Stack>
);

const TimelineConnection: React.FC = () => (
    <Group align="center" gap={0} mx={2} wrap="nowrap">
        <Box w={16} h={2} bg="var(--mantine-color-gray-3)" />
        <SymbolIcon name="chevron_right" size={14} color="rgba(0,0,0,0.26)" />
    </Group>
);

export default MapDialog;
