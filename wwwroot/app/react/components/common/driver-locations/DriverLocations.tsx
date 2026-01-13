/**
 * Driver Locations Component
 *
 * Displays driver locations organized in a three-column layout with areas and courier sections.
 * Replaces the AngularJS driverLocations.html partial.
 */

import React from 'react';
import {
    Box,
    LinearProgress,
    IconButton,
    Tooltip,
} from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';
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
interface DriverRowState {
    isHovered: boolean;
}

class DriverRow extends React.Component<{
    section: IClearListSection;
    variant: 'top' | 'middle' | 'bottom';
    onClick?: () => void;
}, DriverRowState> {
    state: DriverRowState = {
        isHovered: false,
    };

    handleMouseEnter = () => this.setState({ isHovered: true });
    handleMouseLeave = () => this.setState({ isHovered: false });

    render() {
        const { section, variant, onClick } = this.props;
        const { isHovered } = this.state;
        const isActive = (section as any).isActive || false;

        return (
            <Box
                component="tr"
                onClick={onClick}
                onMouseEnter={this.handleMouseEnter}
                onMouseLeave={this.handleMouseLeave}
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
    }
}

/**
 * Area Section Component - renders a single area with its driver sections
 */
interface AreaSectionState {
    isTitleHovered: boolean;
}

class AreaSection extends React.Component<{
    area: IAreaClearList;
    truckMode: TruckMode;
    onAreaClick?: (area: IAreaClearList) => void;
    onCourierClick?: (courier: ICourierData) => void;
}, AreaSectionState> {
    state: AreaSectionState = {
        isTitleHovered: false,
    };

    handleTitleMouseEnter = () => this.setState({ isTitleHovered: true });
    handleTitleMouseLeave = () => this.setState({ isTitleHovered: false });

    handleTitleClick = () => {
        const { area, onAreaClick } = this.props;
        if (onAreaClick) {
            onAreaClick(area);
        }
    };

    handleCourierClick = (section: IClearListSection) => {
        const { onCourierClick } = this.props;
        if (onCourierClick && section.courierData) {
            onCourierClick(section.courierData);
        }
    };

    filterSections = (sections: IClearListSection[]): IClearListSection[] => {
        const { truckMode } = this.props;
        if (!sections) return [];
        return sections.filter(section =>
            shouldShowCourier(section.courierNumber, truckMode)
        );
    };

    render() {
        const { area } = this.props;
        const { isTitleHovered } = this.state;
        const isActive = area.isActive || false;

        const filteredTop = this.filterSections(area.top);
        const filteredMiddle = this.filterSections(area.middle);
        const filteredBottom = this.filterSections(area.bottom);

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
                    onClick={this.handleTitleClick}
                    onMouseEnter={this.handleTitleMouseEnter}
                    onMouseLeave={this.handleTitleMouseLeave}
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
                            {filteredTop.map((section, idx) => (
                                <DriverRow
                                    key={`top-${section.courierNumber}-${idx}`}
                                    section={section}
                                    variant="top"
                                    onClick={() => this.handleCourierClick(section)}
                                />
                            ))}
                            {filteredMiddle.map((section, idx) => (
                                <DriverRow
                                    key={`middle-${section.courierNumber}-${idx}`}
                                    section={section}
                                    variant="middle"
                                    onClick={() => this.handleCourierClick(section)}
                                />
                            ))}
                            {filteredBottom.map((section, idx) => (
                                <DriverRow
                                    key={`bottom-${section.courierNumber}-${idx}`}
                                    section={section}
                                    variant="bottom"
                                    onClick={() => this.handleCourierClick(section)}
                                />
                            ))}
                        </tbody>
                    </Box>
                </Box>
            </Box>
        );
    }
}


/**
 * Main Driver Locations Component
 */
export class DriverLocations extends React.Component<DriverLocationsProps> {
    static defaultProps: Partial<DriverLocationsProps> = {
        truckMode: 'On',
        loading: false,
        showNoData: false,
        showData: false,
    };

    handleClearFilter = () => {
        const { onClearFilter } = this.props;
        if (onClearFilter) {
            onClearFilter();
        }
    };

    render() {
        const {
            driverLocations,
            loading,
            showNoData,
            showData,
            truckMode = 'On',
            activeAreaId,
            onAreaClick,
            onCourierClick,
        } = this.props;

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
                                        onClick={this.handleClearFilter}
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
    }
}

export default DriverLocations;
