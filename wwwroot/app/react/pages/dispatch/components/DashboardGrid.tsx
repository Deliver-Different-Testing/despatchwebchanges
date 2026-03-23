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
import {WidgetPanel} from './WidgetPanel';
import {useDispatchContext} from '../DispatchContext';

import 'react-grid-layout/css/styles.css';

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
    const {boxStates} = useDispatchContext();
    const {width: containerWidth, containerRef} = useContainerWidth();

    const filteredLayout = useMemo(
        () => layout.filter(item => visibleBoxIds.includes(item.i as DispatchBox)),
        [layout, visibleBoxIds]
    );

    const handleLayoutChange = useCallback(
        (currentLayout: Layout) => {
            onLayoutChange(currentLayout);
        },
        [onLayoutChange]
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
                    onLayoutChange={handleLayoutChange}
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
                            <div key={boxId} style={{height: '100%'}}>
                                <WidgetPanel
                                    config={config}
                                    subtitle={getSubtitle?.(boxId)}
                                    isDefaultLayout={isDefaultLayout}
                                    onRefresh={onRefresh ? () => onRefresh(boxId) : undefined}
                                    toolbarContent={renderToolbarContent?.(boxId)}
                                    toolbarActions={renderToolbarActions?.(boxId)}
                                >
                                    {renderWidget(boxId)}
                                </WidgetPanel>
                            </div>
                        );
                    })}
                </Responsive>
            )}
        </Box>
    );
});
