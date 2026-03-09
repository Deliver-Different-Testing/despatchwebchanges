import React, {useState, useEffect, useMemo} from 'react';
import {
    Dialog,
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Box,
    CircularProgress,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../../../query';
import {overviewApi} from '../../../services/overviewApi';
import {configApi} from '../../../services/configApi';
import {HereMap} from '../../../components/common/here-map/HereMap';
import type {HereMapCredentials, HereMapConfig} from '../../../components/common/here-map/HereMap.types';
import type {OverviewTableParentJob} from '../OverviewPage.interfaces';

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
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth={false}
            slotProps={{
                paper: {sx: {width: '90%', maxWidth: '90%', height: '80vh'}},
            }}
        >
            <AppBar position="relative" color="default" elevation={1}>
                <Toolbar variant="dense">
                    <span className="material-symbols-outlined" style={{marginRight: 8}}>
                        map
                    </span>
                    <Typography variant="h6" sx={{flex: 1}}>
                        {delivery?.jobName} Map
                    </Typography>
                    <IconButton edge="end" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Box sx={{flex: 1, position: 'relative', overflow: 'hidden'}}>
                {isLoading && (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10,
                        }}
                    >
                        <Box sx={{textAlign: 'center'}}>
                            <CircularProgress size={60} />
                            <Typography variant="body2" sx={{mt: 2}}>
                                Loading map data...
                            </Typography>
                        </Box>
                    </Box>
                )}

                {!isLoading && credentials && hereMapConfig && (
                    <Box sx={{width: '100%', height: '100%', position: 'relative'}}>
                        <HereMap
                            mapId="overviewMapContainer"
                            credentials={credentials}
                            config={hereMapConfig}
                        />

                        {/* Timeline Navigation Overlay */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 16,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                bgcolor: 'rgba(255,255,255,0.95)',
                                borderRadius: 2,
                                boxShadow: 3,
                                p: 1.5,
                                maxWidth: '90%',
                                overflowX: 'auto',
                            }}
                        >
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 1}}>
                                <span className="material-symbols-outlined" style={{fontSize: 16}}>
                                    timeline
                                </span>
                                <Typography variant="caption" sx={{fontWeight: 600}}>
                                    Delivery Route
                                </Typography>
                            </Box>

                            <Box sx={{display: 'flex', alignItems: 'center'}}>
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
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>
        </Dialog>
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
    <Box
        onClick={onClick}
        sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            minWidth: 60,
        }}
    >
        <Box
            sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: active ? 'primary.main' : 'grey.300',
                color: active ? 'primary.contrastText' : 'text.secondary',
                transition: 'all 0.2s',
                fontWeight: 600,
                fontSize: '0.75rem',
            }}
        >
            {icon ? (
                <span className="material-symbols-outlined" style={{fontSize: 18}}>
                    {icon}
                </span>
            ) : (
                number
            )}
        </Box>
        <Typography
            variant="caption"
            sx={{
                fontSize: '0.6rem',
                fontWeight: active ? 600 : 400,
                color: active ? 'primary.main' : 'text.secondary',
                mt: 0.25,
            }}
        >
            {labelType}
        </Typography>
        {labelName && (
            <Typography
                variant="caption"
                noWrap
                sx={{
                    fontSize: '0.55rem',
                    maxWidth: 70,
                    textAlign: 'center',
                }}
            >
                {labelName}
            </Typography>
        )}
    </Box>
);

const TimelineConnection: React.FC = () => (
    <Box sx={{display: 'flex', alignItems: 'center', mx: 0.25}}>
        <Box sx={{width: 16, height: 2, bgcolor: 'grey.300'}} />
        <span className="material-symbols-outlined" style={{fontSize: 14, color: 'rgba(0,0,0,0.26)'}}>
            chevron_right
        </span>
    </Box>
);

export default MapDialog;
