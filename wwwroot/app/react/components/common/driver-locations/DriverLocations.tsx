/**
 * Driver Locations Component
 *
 * Displays driver locations organized in a three-column layout with areas and courier sections.
 * Replaces the AngularJS driverLocations.html partial.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {ActionIcon, Box, Progress, Tooltip} from '@mantine/core';
import {X} from 'lucide-react';
import {IconUserPin} from '@tabler/icons-react';
import {Icon} from '../icon/Icon';
import classes from './DriverLocations.module.css';
import { NoData } from '../no-data/NoData';
import { driverLocationColors } from '../../../theme/designTokens';
import { ClearListDebugButton } from './ClearListDebugDialog';
import type {
    DriverLocationsProps,
    IAreaClearList,
    IClearListSection,
    ICourierData,
    TruckMode,
} from './DriverLocations.types';
import { shouldShowCourier } from './DriverLocations.types';

// Domain-specific board section colors imported from design tokens
const C = driverLocationColors;

/**
 * Get background color for a driver row based on variant and state
 */
function getRowBackgroundColor(variant: 'top' | 'middle' | 'bottom', isActive: boolean, isHover: boolean): string {
    switch (variant) {
        case 'top':
            if (isActive) return C.top.bgActive;
            if (isHover) return C.top.bgHover;
            return C.top.bg;
        case 'middle':
            if (isHover) return C.middle.bgHover;
            return C.middle.bg;
        case 'bottom':
            if (isHover) return C.bottom.bgHover;
            return C.bottom.bg;
    }
}

/**
 * Get number cell background color based on variant and state
 */
function getNumberBackgroundColor(variant: 'top' | 'middle' | 'bottom', isActive: boolean): string {
    switch (variant) {
        case 'top':
            return isActive ? C.top.numberBgActive : C.top.numberBg;
        case 'middle':
            return isActive ? C.middle.numberBgActive : C.middle.numberBg;
        case 'bottom':
            return isActive ? C.bottom.numberBgActive : C.bottom.numberBg;
    }
}

/**
 * Driver Row Component - renders a single courier row
 */
const DriverRow = React.memo(function DriverRow({
    section,
    variant,
    onCourierClick,
}: {
    section: IClearListSection;
    variant: 'top' | 'middle' | 'bottom';
    onCourierClick?: (courier: ICourierData) => void;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const isActive = (section as IClearListSection & { isActive?: boolean }).isActive || false;

    const handleMouseEnter = useCallback(() => setIsHovered(true), []);
    const handleMouseLeave = useCallback(() => setIsHovered(false), []);
    const handleClick = useCallback(() => {
        if (onCourierClick && section.courierData) {
            onCourierClick(section.courierData);
        }
    }, [onCourierClick, section.courierData]);

    return (
        <Box
            component="tr"
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            data-courier={section.courierNumber}
            style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: getRowBackgroundColor(variant, isActive, isHovered),
                borderBottom: '1px solid',
                borderColor: variant === 'top' ? C.top.border :
                    variant === 'middle' ? C.middle.border : C.bottom.border,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
            }}
        >
            <Box
                component="td"
                style={{
                    padding: '4px 8px',
                    minWidth: '33px',
                    backgroundColor: getNumberBackgroundColor(variant, isActive),
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                }}
            >
                {section.courierNumber}
            </Box>
            <Box component="td" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <Box style={{ flex: 1 }}>
                    {section.destinations?.map((destination, idx) => (
                        <Box
                            key={destination.id || idx}
                            style={{
                                padding: '2px 4px',
                                display: 'inline-block',
                                backgroundColor: C.destination.bg,
                                border: `1px solid ${C.destination.border}`,
                                margin: '2px 0 2px 4px',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                            }}
                        >
                            {destination.label}
                        </Box>
                    ))}
                </Box>
                {section.courierData?.courierId && (
                    <ClearListDebugButton courierId={section.courierData.courierId} />
                )}
            </Box>
        </Box>
    );
});

/**
 * Area Section Component - renders a single area with its driver sections
 */
const AreaSection = React.memo(function AreaSection({
    area,
    truckMode,
    onAreaClick,
    onCourierClick,
}: {
    area: IAreaClearList;
    truckMode: TruckMode;
    onAreaClick?: (area: IAreaClearList) => void;
    onCourierClick?: (courier: ICourierData) => void;
}) {
    const [isTitleHovered, setIsTitleHovered] = useState(false);
    const isActive = area.isActive || false;

    const handleTitleMouseEnter = useCallback(() => setIsTitleHovered(true), []);
    const handleTitleMouseLeave = useCallback(() => setIsTitleHovered(false), []);
    const handleTitleClick = useCallback(() => {
        onAreaClick?.(area);
    }, [onAreaClick, area]);

    const filteredTop = useMemo(
        () => (area.top || []).filter(s => shouldShowCourier(s.courierNumber, truckMode)),
        [area.top, truckMode]
    );
    const filteredMiddle = useMemo(
        () => (area.middle || []).filter(s => shouldShowCourier(s.courierNumber, truckMode)),
        [area.middle, truckMode]
    );
    const filteredBottom = useMemo(
        () => (area.bottom || []).filter(s => shouldShowCourier(s.courierNumber, truckMode)),
        [area.bottom, truckMode]
    );

    // Calculate title background color
    let titleBgColor = C.title.bg;
    if (isActive) {
        titleBgColor = isTitleHovered ? C.title.activeBgHover : C.title.activeBg;
    } else if (isTitleHovered) {
        titleBgColor = C.title.bgHover;
    }

    return (
        <Box
            style={{
                height: `${area.percentHeight}%`,
                marginBottom: '10px',
                backgroundColor: C.area,
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: 'var(--mantine-shadow-xs)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Area Title */}
            <Box
                onClick={handleTitleClick}
                onMouseEnter={handleTitleMouseEnter}
                onMouseLeave={handleTitleMouseLeave}
                style={{
                    backgroundColor: titleBgColor,
                    color: isActive ? '#000' : '#fff',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    minHeight: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 500,
                    transition: 'background-color 0.2s ease',
                    flexShrink: 0,
                }}
            >
                {area.name} {area.totalRemaining}
            </Box>

            {/* Driver Rows */}
            <Box
                className={classes.hiddenScrollbar}
                style={{
                    position: 'relative',
                    overflow: 'auto',
                    flex: 1,
                    marginTop: '-22px',
                    paddingTop: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Box component="table" style={{ width: '100%' }}>
                    <tbody>
                        {filteredTop.map((section) => (
                            <DriverRow
                                key={`top-${section.courierNumber}`}
                                section={section}
                                variant="top"
                                onCourierClick={onCourierClick}
                            />
                        ))}
                        {filteredMiddle.map((section) => (
                            <DriverRow
                                key={`middle-${section.courierNumber}`}
                                section={section}
                                variant="middle"
                                onCourierClick={onCourierClick}
                            />
                        ))}
                        {filteredBottom.map((section) => (
                            <DriverRow
                                key={`bottom-${section.courierNumber}`}
                                section={section}
                                variant="bottom"
                                onCourierClick={onCourierClick}
                            />
                        ))}
                    </tbody>
                </Box>
            </Box>
        </Box>
    );
});


/**
 * Main Driver Locations Component
 */
export const DriverLocations = React.memo(function DriverLocations({
    driverLocations,
    loading = false,
    showNoData = false,
    showData = false,
    truckMode = 'On',
    activeAreaId,
    onAreaClick,
    onCourierClick,
    onClearFilter,
}: DriverLocationsProps) {
    const handleClearFilter = useCallback(() => {
        onClearFilter?.();
    }, [onClearFilter]);

    // Get columns from data - support both structures
    const columns = driverLocations?.columns || [];

    return (
        <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Loading indicator */}
            {loading && (
                // Mantine has no indeterminate bar; an animated full-width track is
                // the busy affordance, named for assistive tech.
                <Progress
                    value={100}
                    animated
                    size="xs"
                    aria-label="Loading driver locations"
                    style={{position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10}}
                />
            )}

            {/* No data state */}
            {showNoData && (
                <NoData
                    title="No Driver Locations"
                    message="Please configure driver locations in Admin Manager to continue."
                    icon={<Icon tabler={IconUserPin}/>}
                />
            )}

            {/* Data display */}
            {showData && (
                <Box
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '4px',
                    }}
                >
                    {/* Clear filter button - shown when an area is active */}
                    {activeAreaId && (
                        <Box style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                            <Tooltip label="Clear driver location filter">
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    size="md"
                                    onClick={handleClearFilter}
                                    aria-label="Clear driver location filter"
                                >
                                    <Icon lucide={X} size={16} />
                                </ActionIcon>
                            </Tooltip>
                        </Box>
                    )}

                    {/* Three column layout */}
                    <Box
                        id="driverLocations"
                        style={{
                            display: 'flex',
                            gap: '8px',
                            height: activeAreaId ? 'calc(100% - 40px)' : '100%',
                        }}
                    >
                        {columns.map((column, colIdx) => (
                            <Box
                                key={colIdx}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                {column.areas?.map((area) => (
                                    <AreaSection
                                        key={area.id}
                                        area={{
                                            ...area,
                                            isActive: area.id === activeAreaId || area.isActive,
                                        }}
                                        truckMode={truckMode}
                                        onAreaClick={onAreaClick}
                                        onCourierClick={onCourierClick}
                                    />
                                ))}
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
});

export default DriverLocations;
