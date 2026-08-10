/**
 * ToolbarActions Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
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


describe('Shell icon buttons', () => {
    it('takes its hover wash and glyph colour from the shell variables', () => {
        // The wash and on-colour differ per tenant (the gold bar cannot use a brand
        // wash), so the button defers to the vars the theme resolver publishes rather
        // than baking either value in. `dfrntMantineTheme.spec` asserts the values.
        renderWithMantine(<SettingsButton onClick={jest.fn()} />);

        const button = screen.getByRole('button', {name: 'Settings'});
        expect(button.style.getPropertyValue('--ai-hover')).toBe('var(--dd-shell-icon-hover)');
        expect(button).toHaveStyle({color: 'var(--dd-on-shell)'});
    });

    it.each([
        ['Messages', <MessagesButton key="m" unreadCount={5} onClick={jest.fn()} />],
        ['Views', <ViewsMenu key="v" views={[{id: 1, name: 'V', selected: true}]} onToggleView={jest.fn()} onClearAll={jest.fn()} />],
    ])('lets the %s count badge escape the round button instead of clipping it', (name, element) => {
        // ActionIcon's root clips its children. That was invisible while the buttons
        // were square, but the circular border now cuts through an Indicator sitting
        // in the top-right corner.
        renderWithMantine(element);

        expect(screen.getByRole('button', {name})).toHaveStyle({overflow: 'visible'});
    });
});

describe('MessagesButton', () => {
    const defaultProps = {
        unreadCount: 0,
        onClick: jest.fn(),
    };

    it('should render without badge and call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithMantine(<MessagesButton {...defaultProps} onClick={onClick} />);

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(screen.queryByText('0')).not.toBeInTheDocument();

        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should render badge with count when unreadCount > 0', () => {
        renderWithMantine(<MessagesButton {...defaultProps} unreadCount={5} />);
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should show 99+ when unreadCount > 99', () => {
        renderWithMantine(<MessagesButton {...defaultProps} unreadCount={150} />);
        expect(screen.getByText('99+')).toBeInTheDocument();
    });
});

describe('RefreshButton', () => {
    const defaultProps = {
        onClick: jest.fn(),
    };

    it('should render enabled refresh button and call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithMantine(<RefreshButton {...defaultProps} onClick={onClick} />);

        const button = screen.getByRole('button');
        expect(button).not.toBeDisabled();

        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should show loading spinner and not call onClick when loading', () => {
        const onClick = jest.fn();
        renderWithMantine(<RefreshButton {...defaultProps} onClick={onClick} loading={true} />);

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
        renderWithMantine(<SettingsButton onClick={onClick} />);

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
        renderWithMantine(<ViewsMenu {...defaultProps} />);

        expect(screen.getByRole('button')).toBeInTheDocument();
        // 2 views are selected
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should open menu with views, Clear Selection, and support onClearAll and onToggleView', async () => {
        const onClearAll = jest.fn();
        const onToggleView = jest.fn();
        renderWithMantine(
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
        renderWithMantine(<ViewsMenu {...defaultProps} onToggleView={onToggleView} />);

        fireEvent.click(screen.getByRole('button'));

        fireEvent.click(await screen.findByText('View 2'));

        expect(onToggleView).toHaveBeenCalledWith(mockViews[1]);
    });

    it('should show "No views available" when views is empty', async () => {
        renderWithMantine(<ViewsMenu {...defaultProps} views={[]} />);

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByText('No views available')).toBeInTheDocument();
    });

    it('should show "No views available" when views is null', async () => {
        renderWithMantine(<ViewsMenu {...defaultProps} views={null} />);

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByText('No views available')).toBeInTheDocument();
    });

    it('should show loading spinner when loading', () => {
        renderWithMantine(<ViewsMenu {...defaultProps} loading={true} />);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should not produce Fragment children warning when menu is open with views', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        renderWithMantine(<ViewsMenu {...defaultProps} />);

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
        renderWithMantine(<LayoutsMenu {...defaultProps} />);

        expect(screen.getByRole('button')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByText('Add layout')).toBeInTheDocument();
        expect(screen.getByText('Switch layout')).toBeInTheDocument();
        expect(screen.getByText('Default')).toBeInTheDocument();
        expect(screen.getByText('Custom Layout 1')).toBeInTheDocument();
    });

    it('should call onSaveLayout when Add layout is clicked', async () => {
        const onSaveLayout = jest.fn();
        renderWithMantine(<LayoutsMenu {...defaultProps} onSaveLayout={onSaveLayout} />);

        fireEvent.click(screen.getByRole('button'));

        fireEvent.click(await screen.findByText('Add layout'));

        expect(onSaveLayout).toHaveBeenCalledTimes(1);
    });

    it('should call onLoadLayout with index when layout is clicked', async () => {
        const onLoadLayout = jest.fn();
        renderWithMantine(<LayoutsMenu {...defaultProps} onLoadLayout={onLoadLayout} />);

        fireEvent.click(screen.getByRole('button'));

        fireEvent.click(await screen.findByText('Custom Layout 1'));

        expect(onLoadLayout).toHaveBeenCalledWith(1);
    });

    it('should highlight current layout', async () => {
        renderWithMantine(
            <LayoutsMenu {...defaultProps} currentLayoutName="Custom Layout 1" />
        );

        fireEvent.click(screen.getByRole('button'));

        const layoutItem = await screen.findByText('Custom Layout 1');
        expect(layoutItem).toHaveStyle({fontWeight: 600});
    });

    it('should expose a delete control for custom layouts but not Default', async () => {
        renderWithMantine(<LayoutsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByLabelText('Delete Custom Layout 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete Custom Layout 2')).toBeInTheDocument();
        expect(screen.queryByLabelText('Delete Default')).not.toBeInTheDocument();
    });

    it('should call onDeleteLayout with index when the trailing delete is clicked', async () => {
        const onDeleteLayout = jest.fn();
        const onLoadLayout = jest.fn();
        renderWithMantine(
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
        renderWithMantine(<LayoutsMenu {...defaultProps} onRenameLayout={jest.fn()} />);

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByLabelText('Rename Custom Layout 1')).toBeInTheDocument();
        expect(screen.queryByLabelText('Rename Default')).not.toBeInTheDocument();
    });

    it('should call onRenameLayout with index without loading the row', async () => {
        const onRenameLayout = jest.fn();
        const onLoadLayout = jest.fn();
        renderWithMantine(
            <LayoutsMenu {...defaultProps} onRenameLayout={onRenameLayout} onLoadLayout={onLoadLayout} />
        );

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(await screen.findByLabelText('Rename Custom Layout 1'));

        expect(onRenameLayout).toHaveBeenCalledWith(1);
        expect(onLoadLayout).not.toHaveBeenCalled();
    });

    it('should not render a rename control without onRenameLayout', async () => {
        renderWithMantine(<LayoutsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Custom Layout 1')).toBeInTheDocument();
        expect(screen.queryByLabelText('Rename Custom Layout 1')).not.toBeInTheDocument();
    });

    it('should not render an Import V1 layouts entry without onImportLayouts', async () => {
        renderWithMantine(<LayoutsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Add layout')).toBeInTheDocument();
        expect(screen.queryByText('Import V1 layouts')).not.toBeInTheDocument();
    });

    it('should call onImportLayouts when Import V1 layouts is clicked', async () => {
        const onImportLayouts = jest.fn();
        renderWithMantine(<LayoutsMenu {...defaultProps} onImportLayouts={onImportLayouts} />);

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(await screen.findByText('Import V1 layouts'));

        expect(onImportLayouts).toHaveBeenCalledTimes(1);
    });

    it('should not render a Customize panels entry without onCustomizePanels', async () => {
        renderWithMantine(<LayoutsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Add layout')).toBeInTheDocument();
        expect(screen.queryByText('Customize panels…')).not.toBeInTheDocument();
    });

    it('should call onCustomizePanels when clicked on a custom layout', async () => {
        const onCustomizePanels = jest.fn();
        renderWithMantine(
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

    it('should offer Customize panels on a user-created layout', async () => {
        const onCustomizePanels = jest.fn();
        renderWithMantine(
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

    it('should disable the editing entries on the read-only Default layout', async () => {
        const onCustomizePanels = jest.fn();
        const onToggleColumnEditMode = jest.fn();
        renderWithMantine(
            <LayoutsMenu
                {...defaultProps}
                currentLayoutName="Default"
                onCustomizePanels={onCustomizePanels}
                onToggleColumnEditMode={onToggleColumnEditMode}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        const customize = (await screen.findByText('Customize panels…')).closest('button')!;
        const editColumns = screen.getByText('Edit columns').closest('button')!;

        expect(customize).toBeDisabled();
        expect(editColumns).toBeDisabled();

        fireEvent.click(customize);
        fireEvent.click(editColumns);
        expect(onCustomizePanels).not.toHaveBeenCalled();
        expect(onToggleColumnEditMode).not.toHaveBeenCalled();
    });

    it('should not render an Edit columns entry without onToggleColumnEditMode', async () => {
        renderWithMantine(<LayoutsMenu {...defaultProps} currentLayoutName="Custom Layout 1" />);
        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Switch layout')).toBeInTheDocument();
        expect(screen.queryByText('Edit columns')).not.toBeInTheDocument();
    });

    it('should toggle the Edit columns bar and reflect the current mode', async () => {
        const onToggleColumnEditMode = jest.fn();
        const {unmount} = renderWithMantine(
            <LayoutsMenu
                {...defaultProps}
                currentLayoutName="Custom Layout 1"
                onToggleColumnEditMode={onToggleColumnEditMode}
            />,
        );
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(await screen.findByText('Edit columns'));
        expect(onToggleColumnEditMode).toHaveBeenCalledTimes(1);
        unmount();

        renderWithMantine(
            <LayoutsMenu
                {...defaultProps}
                currentLayoutName="Custom Layout 1"
                columnEditMode
                onToggleColumnEditMode={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Done editing columns')).toBeInTheDocument();
    });

    it('should not render a Reset layout entry without onResetLayout', async () => {
        renderWithMantine(<LayoutsMenu {...defaultProps} currentLayoutName="Custom Layout 1" />);
        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Switch layout')).toBeInTheDocument();
        expect(screen.queryByText('Reset layout')).not.toBeInTheDocument();
    });

    it('should call onResetLayout from a user-created layout', async () => {
        const onResetLayout = jest.fn();
        renderWithMantine(
            <LayoutsMenu
                {...defaultProps}
                currentLayoutName="Custom Layout 1"
                onResetLayout={onResetLayout}
            />,
        );
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(await screen.findByText('Reset layout'));
        expect(onResetLayout).toHaveBeenCalledTimes(1);
    });

    it('should not offer Reset layout on the Default layout', async () => {
        // The Default is regenerated from code, so there is nothing to reset it from.
        renderWithMantine(
            <LayoutsMenu {...defaultProps} currentLayoutName="Default" onResetLayout={jest.fn()} />,
        );
        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByText('Switch layout')).toBeInTheDocument();
        expect(screen.queryByText('Reset layout')).not.toBeInTheDocument();
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
        renderWithMantine(<ToolbarIconButton {...defaultProps} onClick={onClick} />);

        expect(screen.getByTestId('test-icon')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should be disabled and not call onClick when disabled', () => {
        const onClick = jest.fn();
        renderWithMantine(
            <ToolbarIconButton {...defaultProps} onClick={onClick} disabled={true} />
        );

        expect(screen.getByRole('button')).toBeDisabled();

        fireEvent.click(screen.getByRole('button'));
        expect(onClick).not.toHaveBeenCalled();
    });
});
