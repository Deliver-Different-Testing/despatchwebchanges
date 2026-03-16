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
import type {
    DriverLocationsProps,
    IAreaClearList,
    IClearListSection,
    ICourierData,
    TruckMode,
} from './DriverLocations.types';
import { shouldShowCourier } from './DriverLocations.types';

// Color constants matching the original LESS styles
const COLORS = {
    // Area title colors
    titleBackground: '#5d5d5d',
    titleBackgroundHover: '#707070',
    titleActiveBackground: '#ffeb3b', // @primary-color
    titleActiveBackgroundHover: '#fdd835',

    // Top section (blue)
    topBackground: '#bae1ff',
    topBackgroundHover: '#a8d4f5',
    topBackgroundActive: '#96c7eb',
    topNumberBackground: '#94c5ea',
    topNumberBackgroundActive: '#82b8e0',

    // Middle section (purple)
    middleBackground: '#d4c7ff',
    middleBackgroundHover: '#c6b6fd',
    middleNumberBackground: '#bdaeef',
    middleNumberBackgroundActive: '#ab9ce5',

    // Bottom section (orange)
    bottomBackground: '#ffdfba',
    bottomBackgroundHover: '#f5d0a5',
    bottomNumberBackground: '#ffc888',
    bottomNumberBackgroundActive: '#f5b870',

    // Other
    areaBackground: '#bfbfbf',
    destinationBackground: '#f5f5f5',
    destinationBorder: '#e0e0e0',
};

/**
 * Get background color for a driver row based on variant and state
 */
function getRowBackgroundColor(variant: 'top' | 'middle' | 'bottom', isActive: boolean, isHover: boolean): string {
    switch (variant) {
        case 'top':
            if (isActive) return COLORS.topBackgroundActive;
            if (isHover) return COLORS.topBackgroundHover;
            return COLORS.topBackground;
        case 'middle':
            if (isHover) return COLORS.middleBackgroundHover;
            return COLORS.middleBackground;
        case 'bottom':
            if (isHover) return COLORS.bottomBackgroundHover;
            return COLORS.bottomBackground;
    }
}

/**
 * Get number cell background color based on variant and state
 */
function getNumberBackgroundColor(variant: 'top' | 'middle' | 'bottom', isActive: boolean): string {
    switch (variant) {
        case 'top':
            return isActive ? COLORS.topNumberBackgroundActive : COLORS.topNumberBackground;
        case 'middle':
            return isActive ? COLORS.middleNumberBackgroundActive : COLORS.middleNumberBackground;
        case 'bottom':
            return isActive ? COLORS.bottomNumberBackgroundActive : COLORS.bottomNumberBackground;
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
            sx={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: getRowBackgroundColor(variant, isActive, isHovered),
                borderBottom: '1px solid',
                borderColor: variant === 'top' ? '#a4d2f5' :
                    variant === 'middle' ? '#c6b6fd' : '#efcea9',
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
                    fontSize: '12px',
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
                            backgroundColor: COLORS.destinationBackground,
                            border: `1px solid ${COLORS.destinationBorder}`,
                            margin: '2px 0 2px 4px',
                            borderRadius: '4px',
                            fontSize: '11px',
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
    let titleBgColor = COLORS.titleBackground;
    if (isActive) {
        titleBgColor = isTitleHovered ? COLORS.titleActiveBackgroundHover : COLORS.titleActiveBackground;
    } else if (isTitleHovered) {
        titleBgColor = COLORS.titleBackgroundHover;
    }

    return (
        <Box
            sx={{
                height: `${area.percentHeight}%`,
                marginBottom: '10px',
                backgroundColor: COLORS.areaBackground,
                borderRadius: '4px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
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
