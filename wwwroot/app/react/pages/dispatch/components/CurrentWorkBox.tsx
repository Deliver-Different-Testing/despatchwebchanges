import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Box, Group, Stack, Text} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import type {Dayjs} from 'dayjs';
import {AppPage} from '../../../interfaces/dispatchJob';
import type {DispatchJob, FetchConfig, JobListSearchParams} from '../../../interfaces/dispatchJob';
import type {ShowToastFn} from '../../../services/toastService';
import {fetchCurrentWorkJobs} from '../../../services/jobSearchApi';
import {fetchDriverWorkOverview} from '../../../services/courierApi';
import {queryKeys} from '../../../query/queryClient';
import {JobListPanel} from '../../../components/job-list/JobListPanel';
import {CurrentWorkAllDrivers, IDriverWorkOverview} from '../../../components/common/current-work-all-drivers';
import {IconTruck} from '@tabler/icons-react';
import {Icon} from '../../../components/common/icon/Icon';
import {CourierSearchField} from './CourierSearchField';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
import {SegmentedToggle} from '../../../components/common/segmented-toggle';
import {TruckLoadingStatusDialog} from './TruckLoadingStatusDialog';
import {HeaderSlotPortal} from '../../../components/common/header-slot/HeaderSlotPortal';
import type {CourierSuggestion} from '../../../interfaces';
import {formatCourierDisplayLabel, type CourierDisplayMode} from '../lib/courierDisplayMode';

type Mode = 'overview' | 'active' | 'detail';

/**
 * The drill-down focus (which driver the panel is showing) lives in local state,
 * but the panel is remounted whenever the dispatch shell re-keys its box layout
 * (e.g. a background remote-layout sync bumps `layoutVersion`). Persisting the
 * focus to sessionStorage keeps a manually-picked driver from snapping back to
 * the selected job's courier across those remounts. `appliedJobCourierId` records
 * the last `selectedJobCourierId` we drilled into so a remount replaying the same
 * value doesn't override a more-recent manual pick.
 */
interface CurrentWorkFocus {
    courierId?: number;
    mode: Mode;
    pickedCourierName?: string;
    appliedJobCourierId?: number;
}

const focusStorageKey = (): string => `dispatchCurrentWorkFocus_${window.ContactID ?? 0}`;

function readFocus(): CurrentWorkFocus | null {
    try {
        const saved = sessionStorage.getItem(focusStorageKey());
        return saved ? (JSON.parse(saved) as CurrentWorkFocus) : null;
    } catch {
        return null;
    }
}

function writeFocus(focus: CurrentWorkFocus): void {
    try {
        sessionStorage.setItem(focusStorageKey(), JSON.stringify(focus));
    } catch {
        /* ignore */
    }
}

// The focused-driver segment carries the courier name, so cap its width and
// ellipsize rather than letting a long name stretch the header.
const detailSegmentStyle: React.CSSProperties = {
    maxWidth: 180,
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
};

export interface CurrentWorkBoxProps {
    isUsCustomer: boolean;
    showToast: ShowToastFn;
    /** Auto-refresh interval in ms (React Query refetchInterval); false/undefined = off. */
    refetchIntervalMs?: number | false;
    /** Page-level date filter start — the current work list follows it like the other lists. */
    startDate: Dayjs;
    /** Page-level date filter end — caps the current work window at this day. */
    endDate: Dayjs;
    /** Courier id derived from the currently selected job, if any. */
    selectedJobCourierId?: number;
    /** Display name for the selected job's courier (shown in the breadcrumb). */
    selectedJobCourierName?: string;
    /** Courier number for the selected job's courier, if known (shown in the breadcrumb). */
    selectedJobCourierNumber?: string;
    /** How much courier info to show in the breadcrumb once a courier is focused. */
    courierDisplayMode?: CourierDisplayMode;
    onJobSelect?: (job: DispatchJob) => void;
    /** Card header DOM node; the breadcrumb + truck button portal into it. */
    headerSlot?: HTMLElement | null;
}

const EmptyMessage: React.FC<{children: React.ReactNode}> = ({children}) => (
    <Text p="lg" c="dimmed" ta="center">{children}</Text>
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
    startDate,
    endDate,
    selectedJobCourierId,
    selectedJobCourierName,
    selectedJobCourierNumber,
    courierDisplayMode = 'name',
    onJobSelect,
    headerSlot,
}) => {
    // Restore the drill-down focus so a box-layout remount doesn't reset it.
    const restoredFocus = useMemo(readFocus, []);
    const [courierId, setCourierId] = useState<number | undefined>(
        restoredFocus?.courierId ?? selectedJobCourierId,
    );
    // US tenants land on the overview; everyone else goes straight to the job list.
    const [mode, setMode] = useState<Mode>(
        restoredFocus?.mode ?? ((isUsCustomer && !selectedJobCourierId) ? 'overview' : 'detail'),
    );
    // Name of the focused courier (from the overview drill-in or the search field).
    const [pickedCourierName, setPickedCourierName] = useState<string | undefined>(
        restoredFocus?.pickedCourierName,
    );
    // Last selected-job courier we drilled into; survives remounts via restore so a
    // replayed selectedJobCourierId can't clobber a newer manual pick.
    const appliedJobCourierIdRef = useRef<number | undefined>(restoredFocus?.appliedJobCourierId);

    const persistFocus = (next: Partial<CurrentWorkFocus>) => {
        writeFocus({
            courierId,
            mode,
            pickedCourierName,
            appliedJobCourierId: appliedJobCourierIdRef.current,
            ...next,
        });
    };

    // Selecting a job elsewhere on the page drills into that job's courier here
    // (matches V1 selectJob → getCurrentJobs(job.courierData.courierId)). Skip when
    // the value is unchanged from the last drill-in — a remount replaying the same
    // selectedJobCourierId must not override a driver picked from the overview since.
    useEffect(() => {
        if (selectedJobCourierId && selectedJobCourierId !== appliedJobCourierIdRef.current) {
            appliedJobCourierIdRef.current = selectedJobCourierId;
            setCourierId(selectedJobCourierId);
            setMode('detail');
            setPickedCourierName(undefined);
            persistFocus({courierId: selectedJobCourierId, mode: 'detail', pickedCourierName: undefined});
        }
    }, [selectedJobCourierId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCourierSearchSelect = (courier: CourierSuggestion) => {
        setCourierId(courier.id);
        setPickedCourierName(courier.text);
        setMode('detail');
        persistFocus({courierId: courier.id, pickedCourierName: courier.text, mode: 'detail'});
    };

    // A manually-picked courier (search, or the US overview drill-in) never carries a
    // number — only the currently selected job's assigned courier does.
    const courierName = pickedCourierName ?? selectedJobCourierName;
    const courierNumber = pickedCourierName ? undefined : selectedJobCourierNumber;
    const formattedCourierLabel = formatCourierDisplayLabel(courierDisplayMode, courierName, courierNumber);
    const courierLabel = formattedCourierLabel ?? 'Selected Driver';
    const [truckStatusOpen, {open: openTruckStatus, close: closeTruckStatus}] = useDisclosure(false);

    const overviewQuery = useQuery({
        queryKey: queryKeys.dispatch.driverOverview,
        queryFn: ({signal}) => fetchDriverWorkOverview({signal}),
        enabled: isUsCustomer && (mode === 'overview' || mode === 'active'),
        refetchInterval: refetchIntervalMs,
    });

    const fetchConfig = useMemo<FetchConfig>(() => ({
        fetchFn: fetchCurrentWorkJobs,
        queryKeyFn: (params: JobListSearchParams) => queryKeys.dispatch.currentWork(params),
        initialParams: {
            courierId,
            startDate,
            endDate,
            page: 0,
            pageSize: 50,
        },
        refetchInterval: refetchIntervalMs,
        // GetCurrentWorkList has no searchText/pagination support and always
        // returns the courier's full list, so the panel filters locally.
        clientSideSearch: true,
    }), [courierId, startDate, endDate, refetchIntervalMs]);

    const showDriverList = isUsCustomer && (mode === 'overview' || mode === 'active');
    // Active Drivers reuses the same overview data, narrowed to logged-in drivers.
    const driversForList = useMemo(() => {
        const all = overviewQuery.data ?? [];
        return mode === 'active'
            ? all.filter(d => d.driverStatusText === 'Active')
            : all;
    }, [overviewQuery.data, mode]);
    // The truck button acts on a focused courier — only meaningful in the detail view.
    const showTruckButton = !isUsCustomer || mode === 'detail';

    const jobList = courierId ? (
        <JobListPanel
            // Remount when the courier or date range changes so fetchConfig.initialParams re-seeds.
            key={`${courierId}-${startDate.valueOf()}-${endDate.valueOf()}`}
            showToast={showToast}
            isUsCustomer={isUsCustomer}
            appPage={AppPage.Dispatch}
            storagePrefix="dispatchCurrentWork"
            // GetCurrentWorkList deliberately returns done jobs too, so the panel has to
            // default to the courier's outstanding work (V1 mounted it the same way).
            defaultCategory="in-progress"
            fetchConfig={fetchConfig}
            hideLoggedInSwitch
            onJobSelect={onJobSelect}
        />
    ) : (
        <EmptyMessage>Select a courier to view their current work.</EmptyMessage>
    );

    return (
        <Stack h="100%" gap={0} style={{minHeight: 0}}>
            <HeaderSlotPortal slot={headerSlot}>
                <Group align="center" gap={4} wrap="nowrap" style={{minWidth: 0}}>
                    {isUsCustomer && (
                        <SegmentedToggle<Mode>
                            aria-label="Current work scope"
                            value={mode}
                            onChange={(value) => {
                                setMode(value);
                                persistFocus({mode: value});
                            }}
                            data={[
                                {value: 'overview', label: 'All Drivers'},
                                {value: 'active', label: 'Active Drivers'},
                                {
                                    value: 'detail',
                                    disabled: !courierId,
                                    label: <span style={detailSegmentStyle}>{courierLabel}</span>,
                                },
                            ]}
                        />
                    )}
                    {showTruckButton && (
                        <HeaderActionIcon
                            label="Truck loading status"
                            disabled={!courierId}
                            onClick={openTruckStatus}
                        >
                            <Icon tabler={IconTruck} size={PANEL_CONTROL_GLYPH_SIZE}/>
                        </HeaderActionIcon>
                    )}
                    {/* US dispatchers already have the drivers overview (plus its own
                        name filter) to find a courier, so the direct lookup is only
                        needed for non-US tenants. */}
                    {!isUsCustomer && (
                        <>
                            {courierId && formattedCourierLabel && (
                                <Text fz="sm" fw={600} style={detailSegmentStyle}>{formattedCourierLabel}</Text>
                            )}
                            <Box w={200}>
                                <CourierSearchField
                                    onSelect={handleCourierSearchSelect}
                                    showToast={showToast}
                                />
                            </Box>
                        </>
                    )}
                </Group>
            </HeaderSlotPortal>
            <TruckLoadingStatusDialog
                open={truckStatusOpen}
                courierId={courierId}
                courierLabel={pickedCourierName ?? selectedJobCourierName}
                isUsCustomer={isUsCustomer}
                onClose={closeTruckStatus}
            />
            <Box style={{flex: 1, minHeight: 0, overflow: 'auto'}}>
                {showDriverList ? (
                    <CurrentWorkAllDrivers
                        drivers={driversForList}
                        loading={overviewQuery.isLoading}
                        selectedCourierId={courierId}
                        onDriverSelect={(driver: IDriverWorkOverview) => {
                            setCourierId(driver.courierId);
                            setPickedCourierName(driver.name);
                            setMode('detail');
                            persistFocus({courierId: driver.courierId, pickedCourierName: driver.name, mode: 'detail'});
                        }}
                    />
                ) : (
                    jobList
                )}
            </Box>
        </Stack>
    );
};
