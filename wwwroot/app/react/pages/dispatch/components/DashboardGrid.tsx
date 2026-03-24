/**
 * DashboardGrid - React Grid Layout wrapper
 *
 * Wraps react-grid-layout's Responsive grid to provide the resizable,
 * drag-to-reorder dashboard grid for the dispatch page.
 */

import React, {memo, useCallback, useMemo} from 'react';
import {Responsive, useContainerWidth, verticalCompactor} from 'react-grid-layout';
import type {Layout} from 'react-grid-layout';
import Box from '@mui/material/Box';
import type {SxProps, Theme} from '@mui/material';
import {BOX_CONFIGS, DispatchBox} from '../DispatchPage.interfaces';
import type {BoxConfig} from '../DispatchPage.interfaces';
import {WidgetPanel} from './WidgetPanel';

import 'react-grid-layout/css/styles.css';

/** Per-widget wrapper that avoids inline closures in the map loop */
const GridWidget = memo(function GridWidget({boxId, config, subtitle, isDefaultLayout, onRefresh, toolbarContent, toolbarActions, children}: {
    boxId: DispatchBox;
    config: BoxConfig;
    subtitle: string | undefined;
    isDefaultLayout: boolean;
    onRefresh: ((boxId: DispatchBox) => void) | undefined;
    toolbarContent: React.ReactNode;
    toolbarActions: React.ReactNode;
    children: React.ReactNode;
}) {
    const handleRefresh = useCallback(() => onRefresh?.(boxId), [onRefresh, boxId]);
    return (
        <div key={boxId} style={{height: '100%'}}>
            <WidgetPanel
                config={config}
                subtitle={subtitle}
                isDefaultLayout={isDefaultLayout}
                onRefresh={onRefresh ? handleRefresh : undefined}
                toolbarContent={toolbarContent}
                toolbarActions={toolbarActions}
            >
                {children}
            </WidgetPanel>
        </div>
    );
});

interface DashboardGridProps {
    layout: Layout;
    onLayoutChange: (layout: Layout) => void;
    cols: number;
    rowHeight: number;
    isDefaultLayout: boolean;
    visibleBoxIds: DispatchBox[];
    renderWidget: (boxId: DispatchBox) => React.ReactNode;
    renderToolbarContent?: (boxId: DispatchBox) => React.ReactNode;
    renderToolbarActions?: (boxId: DispatchBox) => React.ReactNode;
    getSubtitle?: (boxId: DispatchBox) => string | undefined;
    onRefresh?: (boxId: DispatchBox) => void;
}

const containerStyle: SxProps<Theme> = {
    height: '100%',
    overflow: 'auto',
    position: 'relative',
};

export const DashboardGrid = memo(function DashboardGrid({
    layout,
    onLayoutChange,
    cols,
    rowHeight,
    isDefaultLayout,
    visibleBoxIds,
    renderWidget,
    renderToolbarContent,
    renderToolbarActions,
    getSubtitle,
    onRefresh,
}: DashboardGridProps) {
    const {width: containerWidth, containerRef} = useContainerWidth();

    const filteredLayout = useMemo(
        () => layout.filter(item => visibleBoxIds.includes(item.i as DispatchBox)),
        [layout, visibleBoxIds]
    );

    const dragConfig = useMemo(() => ({
        enabled: !isDefaultLayout,
        handle: '.drag-handle',
    }), [isDefaultLayout]);

    const resizeConfig = useMemo(() => ({
        enabled: !isDefaultLayout,
    }), [isDefaultLayout]);

    return (
        <Box ref={containerRef} sx={containerStyle}>
            {containerWidth > 0 && (
                <Responsive
                    width={containerWidth}
                    layouts={{lg: filteredLayout}}
                    breakpoints={{lg: 1200, md: 900, sm: 600, xs: 0}}
                    cols={{lg: cols, md: 6, sm: 2, xs: 1}}
                    rowHeight={rowHeight}
                    onLayoutChange={onLayoutChange}
                    dragConfig={dragConfig}
                    resizeConfig={resizeConfig}
                    compactor={verticalCompactor}
                    margin={[8, 8] as [number, number]}
                    containerPadding={[8, 8] as [number, number]}
                >
                    {visibleBoxIds.map(boxId => {
                        const config = BOX_CONFIGS[boxId];
                        if (!config) return null;

                        return (
                            <GridWidget
                                key={boxId}
                                boxId={boxId}
                                config={config}
                                subtitle={getSubtitle?.(boxId)}
                                isDefaultLayout={isDefaultLayout}
                                onRefresh={onRefresh}
                                toolbarContent={renderToolbarContent?.(boxId)}
                                toolbarActions={renderToolbarActions?.(boxId)}
                            >
                                {renderWidget(boxId)}
                            </GridWidget>
                        );
                    })}
                </Responsive>
            )}
        </Box>
    );
});
