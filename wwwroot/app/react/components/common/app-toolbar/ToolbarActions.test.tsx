/**
 * ToolbarActions Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {
    Layout,
    LayoutsMenu,
    MessagesButton,
    RefreshButton,
    SettingsButton,
    ToolbarIconButton,
    View,
    ViewsMenu,
} from './ToolbarActions';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

describe('MessagesButton', () => {
    const defaultProps = {
        unreadCount: 0,
        onClick: jest.fn(),
    };

    it('should render without badge and call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithTheme(<MessagesButton {...defaultProps} onClick={onClick} />);

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(screen.queryByText('0')).not.toBeInTheDocument();

        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should render badge with count when unreadCount > 0', () => {
        renderWithTheme(<MessagesButton {...defaultProps} unreadCount={5} />);
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should show 99+ when unreadCount > 99', () => {
        renderWithTheme(<MessagesButton {...defaultProps} unreadCount={150} />);
        expect(screen.getByText('99+')).toBeInTheDocument();
    });
});

describe('RefreshButton', () => {
    const defaultProps = {
        onClick: jest.fn(),
    };

    it('should render enabled refresh button and call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithTheme(<RefreshButton {...defaultProps} onClick={onClick} />);

        const button = screen.getByRole('button');
        expect(button).not.toBeDisabled();

        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should show loading spinner and not call onClick when loading', () => {
        const onClick = jest.fn();
        renderWithTheme(<RefreshButton {...defaultProps} onClick={onClick} loading={true} />);

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();

        fireEvent.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });
});

describe('SettingsButton', () => {
    it('should render settings button and call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithTheme(<SettingsButton onClick={onClick} />);

        expect(screen.getByRole('button')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});

describe('ViewsMenu', () => {
    const mockViews: View[] = [
        {id: 1, name: 'View 1', selected: true},
        {id: 2, name: 'View 2', selected: false},
        {id: 3, name: 'View 3', selected: true},
    ];

    const defaultProps = {
        views: mockViews,
        onToggleView: jest.fn(),
        onClearAll: jest.fn(),
    };

    it('should render menu button with selected count badge', () => {
        renderWithTheme(<ViewsMenu {...defaultProps} />);

        expect(screen.getByRole('button')).toBeInTheDocument();
        // 2 views are selected
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should open menu with views, Clear Selection, and support onClearAll and onToggleView', async () => {
        const onClearAll = jest.fn();
        const onToggleView = jest.fn();
        renderWithTheme(
            <ViewsMenu {...defaultProps} onClearAll={onClearAll} onToggleView={onToggleView} />
        );

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByText('View 1')).toBeInTheDocument();
        expect(screen.getByText('View 2')).toBeInTheDocument();
        expect(screen.getByText('View 3')).toBeInTheDocument();

        // Clear Selection is visible
        expect(screen.getByText('Clear Selection')).toBeInTheDocument();

        // Click Clear Selection
        fireEvent.click(screen.getByText('Clear Selection'));
        expect(onClearAll).toHaveBeenCalledTimes(1);
    });

    it('should call onToggleView when a view is clicked', async () => {
        const onToggleView = jest.fn();
        renderWithTheme(<ViewsMenu {...defaultProps} onToggleView={onToggleView} />);

        fireEvent.click(screen.getByRole('button'));

        fireEvent.click(await screen.findByText('View 2'));

        expect(onToggleView).toHaveBeenCalledWith(mockViews[1]);
    });

    it('should show "No views available" when views is empty', async () => {
        renderWithTheme(<ViewsMenu {...defaultProps} views={[]} />);

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByText('No views available')).toBeInTheDocument();
    });

    it('should show "No views available" when views is null', async () => {
        renderWithTheme(<ViewsMenu {...defaultProps} views={null} />);

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByText('No views available')).toBeInTheDocument();
    });

    it('should show loading spinner when loading', () => {
        renderWithTheme(<ViewsMenu {...defaultProps} loading={true} />);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should not produce Fragment children warning when menu is open with views', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        renderWithTheme(<ViewsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByText('View 1')).toBeInTheDocument();

        const fragmentWarnings = consoleErrorSpy.mock.calls.filter(
            (args) => typeof args[0] === 'string' && args[0].includes('Fragment as a child')
        );
        expect(fragmentWarnings).toHaveLength(0);
        consoleErrorSpy.mockRestore();
    });
});

describe('LayoutsMenu', () => {
    const mockLayouts: Layout[] = [
        {name: 'Default'},
        {name: 'Custom Layout 1'},
        {name: 'Custom Layout 2'},
    ];

    const defaultProps = {
        layouts: mockLayouts,
        onSaveLayout: jest.fn(),
        onLoadLayout: jest.fn(),
        onDeleteLayout: jest.fn(),
    };

    it('should render menu button and open menu when clicked', async () => {
        renderWithTheme(<LayoutsMenu {...defaultProps} />);

        expect(screen.getByRole('button')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByText('Add layout')).toBeInTheDocument();
        expect(screen.getByText('Switch layout')).toBeInTheDocument();
        expect(screen.getByText('Default')).toBeInTheDocument();
        expect(screen.getByText('Custom Layout 1')).toBeInTheDocument();
    });

    it('should call onSaveLayout when Add layout is clicked', async () => {
        const onSaveLayout = jest.fn();
        renderWithTheme(<LayoutsMenu {...defaultProps} onSaveLayout={onSaveLayout} />);

        fireEvent.click(screen.getByRole('button'));

        fireEvent.click(await screen.findByText('Add layout'));

        expect(onSaveLayout).toHaveBeenCalledTimes(1);
    });

    it('should call onLoadLayout with index when layout is clicked', async () => {
        const onLoadLayout = jest.fn();
        renderWithTheme(<LayoutsMenu {...defaultProps} onLoadLayout={onLoadLayout} />);

        fireEvent.click(screen.getByRole('button'));

        fireEvent.click(await screen.findByText('Custom Layout 1'));

        expect(onLoadLayout).toHaveBeenCalledWith(1);
    });

    it('should highlight current layout', async () => {
        renderWithTheme(
            <LayoutsMenu {...defaultProps} currentLayoutName="Custom Layout 1" />
        );

        fireEvent.click(screen.getByRole('button'));

        const layoutItem = await screen.findByText('Custom Layout 1');
        expect(layoutItem).toHaveStyle({fontWeight: 600});
    });

    it('should expose a delete control for custom layouts but not Default', async () => {
        renderWithTheme(<LayoutsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByLabelText('Delete Custom Layout 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete Custom Layout 2')).toBeInTheDocument();
        expect(screen.queryByLabelText('Delete Default')).not.toBeInTheDocument();
    });

    it('should call onDeleteLayout with index when the trailing delete is clicked', async () => {
        const onDeleteLayout = jest.fn();
        const onLoadLayout = jest.fn();
        renderWithTheme(
            <LayoutsMenu
                {...defaultProps}
                onDeleteLayout={onDeleteLayout}
                onLoadLayout={onLoadLayout}
            />
        );

        fireEvent.click(screen.getByRole('button'));

        fireEvent.click(await screen.findByLabelText('Delete Custom Layout 1'));

        expect(onDeleteLayout).toHaveBeenCalledWith(1);
        // Deleting must not also trigger a layout load on the same row.
        expect(onLoadLayout).not.toHaveBeenCalled();
    });

    it('should expose a rename control for custom layouts but not Default', async () => {
        renderWithTheme(<LayoutsMenu {...defaultProps} onRenameLayout={jest.fn()} />);

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByLabelText('Rename Custom Layout 1')).toBeInTheDocument();
        expect(screen.queryByLabelText('Rename Default')).not.toBeInTheDocument();
    });

    it('should call onRenameLayout with index without loading the row', async () => {
        const onRenameLayout = jest.fn();
        const onLoadLayout = jest.fn();
        renderWithTheme(
            <LayoutsMenu {...defaultProps} onRenameLayout={onRenameLayout} onLoadLayout={onLoadLayout} />
        );

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(await screen.findByLabelText('Rename Custom Layout 1'));

        expect(onRenameLayout).toHaveBeenCalledWith(1);
        expect(onLoadLayout).not.toHaveBeenCalled();
    });

    it('should not render a rename control without onRenameLayout', async () => {
        renderWithTheme(<LayoutsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Custom Layout 1')).toBeInTheDocument();
        expect(screen.queryByLabelText('Rename Custom Layout 1')).not.toBeInTheDocument();
    });

    it('should not render an Import V1 layouts entry without onImportLayouts', async () => {
        renderWithTheme(<LayoutsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Add layout')).toBeInTheDocument();
        expect(screen.queryByText('Import V1 layouts')).not.toBeInTheDocument();
    });

    it('should call onImportLayouts when Import V1 layouts is clicked', async () => {
        const onImportLayouts = jest.fn();
        renderWithTheme(<LayoutsMenu {...defaultProps} onImportLayouts={onImportLayouts} />);

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(await screen.findByText('Import V1 layouts'));

        expect(onImportLayouts).toHaveBeenCalledTimes(1);
    });

    it('should not render a Customize panels entry without onCustomizePanels', async () => {
        renderWithTheme(<LayoutsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Add layout')).toBeInTheDocument();
        expect(screen.queryByText('Customize panels…')).not.toBeInTheDocument();
    });

    it('should call onCustomizePanels when clicked on a custom layout', async () => {
        const onCustomizePanels = jest.fn();
        renderWithTheme(
            <LayoutsMenu
                {...defaultProps}
                currentLayoutName="Custom Layout 1"
                onCustomizePanels={onCustomizePanels}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(await screen.findByText('Customize panels…'));

        expect(onCustomizePanels).toHaveBeenCalledTimes(1);
    });

    it('should disable Customize panels on the Default layout', async () => {
        const onCustomizePanels = jest.fn();
        renderWithTheme(
            <LayoutsMenu
                {...defaultProps}
                currentLayoutName="Default"
                onCustomizePanels={onCustomizePanels}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Customize panels…')).toBeInTheDocument();

        // The entry is disabled, so clicking it must not open the dialog.
        fireEvent.click(screen.getByText('Customize panels…'));
        expect(onCustomizePanels).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: /customize panels/i}))
            .toHaveAttribute('aria-disabled', 'true');
    });

    it('should not render an Edit layout entry without onToggleEditMode', async () => {
        renderWithTheme(<LayoutsMenu {...defaultProps} currentLayoutName="Custom Layout 1" />);
        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Switch layout')).toBeInTheDocument();
        expect(screen.queryByText('Edit layout')).not.toBeInTheDocument();
    });

    it('should call onToggleEditMode when Edit layout is clicked on a custom layout', async () => {
        const onToggleEditMode = jest.fn();
        renderWithTheme(
            <LayoutsMenu
                {...defaultProps}
                currentLayoutName="Custom Layout 1"
                onToggleEditMode={onToggleEditMode}
            />,
        );
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(await screen.findByText('Edit layout'));
        expect(onToggleEditMode).toHaveBeenCalledTimes(1);
    });

    it('should show "Done editing" when editMode is on', async () => {
        renderWithTheme(
            <LayoutsMenu
                {...defaultProps}
                currentLayoutName="Custom Layout 1"
                editMode
                onToggleEditMode={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Done editing')).toBeInTheDocument();
        expect(screen.queryByText('Edit layout')).not.toBeInTheDocument();
    });

    it('should disable Edit layout on the Default layout', async () => {
        const onToggleEditMode = jest.fn();
        renderWithTheme(
            <LayoutsMenu
                {...defaultProps}
                currentLayoutName="Default"
                onToggleEditMode={onToggleEditMode}
            />,
        );
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(await screen.findByText('Edit layout'));
        expect(onToggleEditMode).not.toHaveBeenCalled();
    });
});

describe('ToolbarIconButton', () => {
    const defaultProps = {
        icon: <span data-testid="test-icon">Icon</span>,
        tooltip: 'Test Tooltip',
        onClick: jest.fn(),
    };

    it('should render with icon and call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithTheme(<ToolbarIconButton {...defaultProps} onClick={onClick} />);

        expect(screen.getByTestId('test-icon')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should be disabled and not call onClick when disabled', () => {
        const onClick = jest.fn();
        renderWithTheme(
            <ToolbarIconButton {...defaultProps} onClick={onClick} disabled={true} />
        );

        expect(screen.getByRole('button')).toBeDisabled();

        fireEvent.click(screen.getByRole('button'));
        expect(onClick).not.toHaveBeenCalled();
    });
});
