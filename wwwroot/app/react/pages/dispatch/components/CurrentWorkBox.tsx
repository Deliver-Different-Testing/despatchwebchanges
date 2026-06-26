import React, {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import dayjs from 'dayjs';
import {AppPage} from '../../../interfaces/dispatchJob';
import type {DispatchJob} from '../../../interfaces/dispatchJob';
import type {ShowToastFn} from '../../../services/toastService';
import {fetchCurrentWorkJobs} from '../../../services/jobSearchApi';
import {fetchDriverWorkOverview} from '../../../services/courierApi';
import {queryKeys} from '../../../query/queryClient';
import {JobListPanel} from '../../../components/job-list/JobListPanel';
import {CurrentWorkAllDrivers, IDriverWorkOverview} from '../../../components/common/current-work-all-drivers';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import type {SxProps, Theme} from '@mui/material/styles';
import {CourierSearchField} from './CourierSearchField';
import {TruckLoadingStatusDialog} from './TruckLoadingStatusDialog';
import {HeaderSlotPortal} from '../../../components/common/header-slot/HeaderSlotPortal';
import type {CourierSuggestion} from '../../../interfaces';

type Mode = 'overview' | 'selected';

// Segmented control tuned for the gradient panel header: inherits the header's
// contrast colour, translucent-white borders/fill matching the icon-badge tone.
const headerToggleSx = {
    '& .MuiToggleButton-root': {
        color: 'inherit',
        borderColor: 'rgba(255,255,255,0.5)',
        textTransform: 'none',
        maxWidth: 160,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'block',
    },
    '& .MuiToggleButton-root:hover': {bgcolor: 'rgba(255,255,255,0.12)'},
    '& .MuiToggleButton-root.Mui-selected': {
        color: 'inherit',
        bgcolor: 'rgba(255,255,255,0.25)',
        '&:hover': {bgcolor: 'rgba(255,255,255,0.32)'},
    },
} satisfies SxProps<Theme>;

const headerIconButtonSx = {color: 'inherit', '&:hover': {bgcolor: 'rgba(255,255,255,0.12)'}} satisfies SxProps<Theme>;

export interface CurrentWorkBoxProps {
    isUsCustomer: boolean;
    showToast: ShowToastFn;
    /** Auto-refresh interval in ms (React Query refetchInterval); false/undefined = off. */
    refetchIntervalMs?: number | false;
    /** Courier id derived from the currently selected job, if any. */
    selectedJobCourierId?: number;
    /** Display name for the selected job's courier (used on the toggle). */
    selectedJobCourierName?: string;
    onJobSelect?: (job: DispatchJob) => void;
    /** Card header DOM node; the mode toggle + truck button portal into it. */
    headerSlot?: HTMLElement | null;
}

const EmptyMessage: React.FC<{children: React.ReactNode}> = ({children}) => (
    <Box sx={{p: 3, color: 'text.secondary', textAlign: 'center'}}>{children}</Box>
);

/**
 * "Current Work" panel for the React dispatch page. Mirrors the AngularJS
 * home `currentWork` partial:
 *   - US tenants get an "All Drivers" overview (job counts) and a "Selected
 *     Driver" job list, toggled by a radio/segmented control.
 *   - Other tenants get the selected courier's job list directly.
 * The selected courier is seeded from the currently selected job and can be
 * changed by picking a driver from the overview.
 *
 * Reuses the existing `CurrentWorkAllDrivers` overview and the shared
 * `JobListPanel` (driven by React Query via fetchConfig) rather than the
 * AngularJS data-push bridge.
 */
export const CurrentWorkBox: React.FC<CurrentWorkBoxProps> = ({
    isUsCustomer,
    showToast,
    refetchIntervalMs = false,
    selectedJobCourierId,
    selectedJobCourierName,
    onJobSelect,
    headerSlot,
}) => {
    const [courierId, setCourierId] = useState<number | undefined>(selectedJobCourierId);
    const [mode, setMode] = useState<Mode>(isUsCustomer ? 'overview' : 'selected');
    // Name of a courier picked via the search field (overrides the job's courier label).
    const [pickedCourierName, setPickedCourierName] = useState<string | undefined>();

    // Selecting a job elsewhere on the page focuses that job's courier here
    // (matches V1 selectJob → getCurrentJobs(job.courierData.courierId)).
    useEffect(() => {
        if (selectedJobCourierId) {
            setCourierId(selectedJobCourierId);
            setMode('selected');
            setPickedCourierName(undefined);
        }
    }, [selectedJobCourierId]);

    const handleCourierSearchSelect = (courier: CourierSuggestion) => {
        setCourierId(courier.id);
        setPickedCourierName(courier.text);
        setMode('selected');
    };

    const courierLabel = pickedCourierName ?? selectedJobCourierName ?? 'Selected Driver';
    const [truckStatusOpen, setTruckStatusOpen] = useState(false);

    const overviewQuery = useQuery({
        queryKey: queryKeys.dispatch.driverOverview,
        queryFn: ({signal}) => fetchDriverWorkOverview({signal}),
        enabled: isUsCustomer && mode === 'overview',
        refetchInterval: refetchIntervalMs,
    });

    const fetchConfig = useMemo(() => ({
        fetchFn: fetchCurrentWorkJobs,
        queryKeyFn: (params: any) => queryKeys.dispatch.currentWork(params),
        initialParams: {
            courierId,
            startDate: dayjs().startOf('day'),
            endDate: dayjs().endOf('day'),
            page: 0,
            pageSize: 50,
        },
        refetchInterval: refetchIntervalMs,
    }), [courierId, refetchIntervalMs]);

    const showOverview = isUsCustomer && mode === 'overview';

    const jobList = courierId ? (
        <JobListPanel
            // Remount when the courier changes so fetchConfig.initialParams re-seeds.
            key={courierId}
            showToast={showToast}
            isUsCustomer={isUsCustomer}
            appPage={AppPage.Dispatch}
            storagePrefix="dispatchCurrentWork"
            fetchConfig={fetchConfig as any}
            hideLoggedInSwitch
            onJobSelect={onJobSelect}
        />
    ) : (
        <EmptyMessage>Select a courier to view their current work.</EmptyMessage>
    );

    return (
        <Box sx={{height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0}}>
            <HeaderSlotPortal slot={headerSlot}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                    {isUsCustomer && (
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={mode}
                            onChange={(_, next: Mode | null) => {
                                if (next) setMode(next);
                            }}
                            aria-label="Driver view"
                            sx={headerToggleSx}
                        >
                            <ToggleButton value="overview">All Drivers</ToggleButton>
                            <ToggleButton value="selected" disabled={!courierId}>
                                {courierLabel}
                            </ToggleButton>
                        </ToggleButtonGroup>
                    )}
                    <Tooltip title="Truck loading status">
                        <span>
                            <IconButton
                                size="small"
                                aria-label="Truck loading status"
                                disabled={!courierId}
                                onClick={() => setTruckStatusOpen(true)}
                                sx={headerIconButtonSx}
                            >
                                <LocalShippingIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            </HeaderSlotPortal>
            <Box sx={{px: 1, pt: 0.5, flexShrink: 0}}>
                <CourierSearchField onSelect={handleCourierSearchSelect} />
            </Box>
            <TruckLoadingStatusDialog
                open={truckStatusOpen}
                courierId={courierId}
                courierLabel={pickedCourierName ?? selectedJobCourierName}
                isUsCustomer={isUsCustomer}
                onClose={() => setTruckStatusOpen(false)}
            />
            <Box sx={{flex: 1, minHeight: 0, overflow: 'auto'}}>
                {showOverview ? (
                    <CurrentWorkAllDrivers
                        drivers={overviewQuery.data ?? []}
                        loading={overviewQuery.isLoading}
                        selectedCourierId={courierId}
                        onDriverSelect={(driver: IDriverWorkOverview) => {
                            setCourierId(driver.courierId);
                            setMode('selected');
                        }}
                    />
                ) : (
                    jobList
                )}
            </Box>
        </Box>
    );
};
