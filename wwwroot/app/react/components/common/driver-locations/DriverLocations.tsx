/**
 * Driver Locations Component
 *
 * Displays driver locations organized in a three-column layout with areas and courier sections.
 * Replaces the AngularJS driverLocations.html partial.
 */

import React, { useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ClearIcon from '@mui/icons-material/Clear';
import { NoData } from '../no-data/NoData';
import { driverLocationColors } from '../../../theme/designTokens';
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
const DriverRow = React.memo(({
                                  section,
                                  variant,
                                  onCourierClick,
                              }: {
    section: IClearListSection;
    variant: 'top' | 'middle' | 'bottom';
    onCourierClick?: (courier: ICourierData) => void;
}) => {
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
            sx={{
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
                sx={{
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
            <Box component="td" sx={{ flex: 1 }}>
                {section.destinations?.map((destination, idx) => (
                    <Box
                        key={destination.id || idx}
                        sx={{
                            padding: '2px 4px',
                            display: 'inline-block',
                            backgroundColor: C.destination.bg,
                            border: `1px solid ${C.destination.border}`,
                            margin: '2px 0 2px 4px',
                            borderRadius: 1,
                            fontSize: '0.75rem',
                        }}
                    >
                        {destination.label}
                    </Box>
                ))}
            </Box>
        </Box>
    );
});

/**
 * Area Section Component - renders a single area with its driver sections
 */
const AreaSection = React.memo(({
                                    area,
                                    truckMode,
                                    onAreaClick,
                                    onCourierClick,
                                }: {
    area: IAreaClearList;
    truckMode: TruckMode;
    onAreaClick?: (area: IAreaClearList) => void;
    onCourierClick?: (courier: ICourierData) => void;
}) => {
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
            sx={{
                height: `${area.percentHeight}%`,
                marginBottom: '10px',
                backgroundColor: C.area,
                borderRadius: 1,
                overflow: 'hidden',
                boxShadow: 1,
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Area Title */}
            <Box
                onClick={handleTitleClick}
                onMouseEnter={handleTitleMouseEnter}
                onMouseLeave={handleTitleMouseLeave}
                sx={{
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
                sx={{
                    position: 'relative',
                    overflow: 'auto',
                    flex: 1,
                    marginTop: '-22px',
                    paddingTop: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    // Hide scrollbar
                    '&::-webkit-scrollbar': { display: 'none' },
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                }}
            >
                <Box component="table" sx={{ width: '100%' }}>
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
export const DriverLocations = React.memo(({
                                               driverLocations,
                                               loading = false,
                                               showNoData = false,
                                               showData = false,
                                               truckMode = 'On',
                                               activeAreaId,
                                               onAreaClick,
                                               onCourierClick,
                                               onClearFilter,
                                           }: DriverLocationsProps) => {
    const handleClearFilter = useCallback(() => {
        onClearFilter?.();
    }, [onClearFilter]);

    // Get columns from data - support both structures
    const columns = driverLocations?.columns || [];

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Loading indicator */}
            {loading && (
                <LinearProgress
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 10,
                    }}
                />
            )}

            {/* No data state */}
            {showNoData && (
                <NoData
                    title="No Driver Locations"
                    message="Please configure driver locations in Admin Manager to continue."
                    icon="person_pin_circle"
                />
            )}

            {/* Data display */}
            {showData && (
                <Box
                    sx={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '4px',
                    }}
                >
                    {/* Clear filter button - shown when an area is active */}
                    {activeAreaId && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                            <Tooltip title="Clear driver location filter">
                                <IconButton
                                    size="small"
                                    onClick={handleClearFilter}
                                    sx={{
                                        backgroundColor: 'action.hover',
                                        '&:hover': { backgroundColor: 'action.selected' },
                                    }}
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )}

                    {/* Three column layout */}
                    <Box
                        id="driverLocations"
                        sx={{
                            display: 'flex',
                            gap: '8px',
                            height: activeAreaId ? 'calc(100% - 40px)' : '100%',
                        }}
                    >
                        {columns.map((column, colIdx) => (
                            <Box
                                key={colIdx}
                                sx={{
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
