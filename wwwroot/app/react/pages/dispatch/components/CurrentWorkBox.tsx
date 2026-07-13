import React, {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import type {SxProps, Theme} from '@mui/material/styles';
import {CourierSearchField} from './CourierSearchField';
import {TruckLoadingStatusDialog} from './TruckLoadingStatusDialog';
import {HeaderSlotPortal} from '../../../components/common/header-slot/HeaderSlotPortal';
import type {CourierSuggestion} from '../../../interfaces';

type Mode = 'overview' | 'detail';

// "‹ All Drivers" back link on the gradient panel header: inherits the header's
// contrast colour with a translucent-white hover matching the icon-badge tone.
const headerBackButtonSx = {
    color: 'inherit',
    textTransform: 'none',
    px: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    '&:hover': {bgcolor: 'rgba(255,255,255,0.12)'},
} satisfies SxProps<Theme>;

const headerDriverNameSx = {
    opacity: 0.9,
    maxWidth: 160,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
} satisfies SxProps<Theme>;

const headerIconButtonSx = {color: 'inherit', '&:hover': {bgcolor: 'rgba(255,255,255,0.12)'}} satisfies SxProps<Theme>;

export interface CurrentWorkBoxProps {
    isUsCustomer: boolean;
    showToast: ShowToastFn;
    /** Auto-refresh interval in ms (React Query refetchInterval); false/undefined = off. */
    refetchIntervalMs?: number | false;
    /** Courier id derived from the currently selected job, if any. */
    selectedJobCourierId?: number;
    /** Display name for the selected job's courier (shown in the breadcrumb). */
    selectedJobCourierName?: string;
    onJobSelect?: (job: DispatchJob) => void;
    /** Card header DOM node; the breadcrumb + truck button portal into it. */
    headerSlot?: HTMLElement | null;
}

const EmptyMessage: React.FC<{children: React.ReactNode}> = ({children}) => (
    <Box sx={{p: 3, color: 'text.secondary', textAlign: 'center'}}>{children}</Box>
);

/**
 * "Current Work" panel for the React dispatch page. Mirrors the AngularJS
 * home `currentWork` partial:
 *   - US tenants browse an "All Drivers" overview (job counts) and drill into a
 *     single driver's job list; a breadcrumb back-link returns to the overview.
 *   - Other tenants pick a courier via search and see their job list directly.
 * The focused courier is also seeded from the currently selected job.
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
    // US tenants land on the overview; everyone else goes straight to the job list.
    const [mode, setMode] = useState<Mode>(isUsCustomer ? 'overview' : 'detail');
    // Name of the focused courier (from the overview drill-in or the search field).
    const [pickedCourierName, setPickedCourierName] = useState<string | undefined>();

    // Selecting a job elsewhere on the page drills into that job's courier here
    // (matches V1 selectJob → getCurrentJobs(job.courierData.courierId)).
    useEffect(() => {
        if (selectedJobCourierId) {
            setCourierId(selectedJobCourierId);
            setMode('detail');
            setPickedCourierName(undefined);
        }
    }, [selectedJobCourierId]);

    const handleCourierSearchSelect = (courier: CourierSuggestion) => {
        setCourierId(courier.id);
        setPickedCourierName(courier.text);
        setMode('detail');
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
    // The truck button acts on a focused courier — only meaningful in the detail view.
    const showTruckButton = !isUsCustomer || mode === 'detail';

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
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0}}>
                    {isUsCustomer && mode === 'detail' && (
                        <>
                            <Button
                                size="small"
                                startIcon={<ChevronLeftIcon />}
                                onClick={() => setMode('overview')}
                                sx={headerBackButtonSx}
                            >
                                All Drivers
                            </Button>
                            <Box component="span" sx={{opacity: 0.5}}>&middot;</Box>
                            <Typography variant="body2" sx={headerDriverNameSx}>
                                {courierLabel}
                            </Typography>
                        </>
                    )}
                    {showTruckButton && (
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
                    )}
                </Box>
            </HeaderSlotPortal>
            <TruckLoadingStatusDialog
                open={truckStatusOpen}
                courierId={courierId}
                courierLabel={pickedCourierName ?? selectedJobCourierName}
                isUsCustomer={isUsCustomer}
                onClose={() => setTruckStatusOpen(false)}
            />
            {!isUsCustomer && (
                <Box sx={{px: 1, pt: 0.5, flexShrink: 0}}>
                    <CourierSearchField onSelect={handleCourierSearchSelect} />
                </Box>
            )}
            <Box sx={{flex: 1, minHeight: 0, overflow: 'auto'}}>
                {showOverview ? (
                    <CurrentWorkAllDrivers
                        drivers={overviewQuery.data ?? []}
                        loading={overviewQuery.isLoading}
                        selectedCourierId={courierId}
                        onDriverSelect={(driver: IDriverWorkOverview) => {
                            setCourierId(driver.courierId);
                            setPickedCourierName(driver.name);
                            setMode('detail');
                        }}
                    />
                ) : (
                    jobList
                )}
            </Box>
        </Box>
    );
};
