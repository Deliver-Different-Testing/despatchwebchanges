/**
 * ToolbarActions Component Tests
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render without badge when unreadCount is 0', () => {
        renderWithTheme(<MessagesButton {...defaultProps} />);
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('should render badge with count when unreadCount > 0', () => {
        renderWithTheme(<MessagesButton {...defaultProps} unreadCount={5} />);
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should show 99+ when unreadCount > 99', () => {
        renderWithTheme(<MessagesButton {...defaultProps} unreadCount={150} />);
        expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithTheme(<MessagesButton {...defaultProps} onClick={onClick} />);

        fireEvent.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});

describe('RefreshButton', () => {
    const defaultProps = {
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render refresh icon when not loading', () => {
        renderWithTheme(<RefreshButton {...defaultProps} />);
        const button = screen.getByRole('button');
        expect(button).not.toBeDisabled();
    });

    it('should show loading spinner when loading', () => {
        renderWithTheme(<RefreshButton {...defaultProps} loading={true} />);
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithTheme(<RefreshButton {...defaultProps} onClick={onClick} />);

        fireEvent.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when loading and clicked', () => {
        const onClick = jest.fn();
        renderWithTheme(<RefreshButton {...defaultProps} onClick={onClick} loading={true} />);

        fireEvent.click(screen.getByRole('button'));

        expect(onClick).not.toHaveBeenCalled();
    });
});

describe('SettingsButton', () => {
    const defaultProps = {
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render settings button', () => {
        renderWithTheme(<SettingsButton {...defaultProps} />);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithTheme(<SettingsButton {...defaultProps} onClick={onClick} />);

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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render menu button', () => {
        renderWithTheme(<ViewsMenu {...defaultProps} />);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should show badge with selected count', () => {
        renderWithTheme(<ViewsMenu {...defaultProps} />);
        // 2 views are selected
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should open menu when button is clicked', async () => {
        renderWithTheme(<ViewsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            expect(screen.getByText('View 1')).toBeInTheDocument();
            expect(screen.getByText('View 2')).toBeInTheDocument();
            expect(screen.getByText('View 3')).toBeInTheDocument();
        });
    });

    it('should show Clear Selection option', async () => {
        renderWithTheme(<ViewsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));

        expect(await screen.findByText('Clear Selection')).toBeInTheDocument();
    });

    it('should call onClearAll when Clear Selection is clicked', async () => {
        const onClearAll = jest.fn();
        renderWithTheme(<ViewsMenu {...defaultProps} onClearAll={onClearAll} />);

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            fireEvent.click(screen.getByText('Clear Selection'));
        });

        expect(onClearAll).toHaveBeenCalledTimes(1);
    });

    it('should call onToggleView when a view is clicked', async () => {
        const onToggleView = jest.fn();
        renderWithTheme(<ViewsMenu {...defaultProps} onToggleView={onToggleView} />);

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            fireEvent.click(screen.getByText('View 2'));
        });

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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render menu button', () => {
        renderWithTheme(<LayoutsMenu {...defaultProps} />);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should open menu when button is clicked', async () => {
        renderWithTheme(<LayoutsMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            expect(screen.getByText('Add Layout')).toBeInTheDocument();
            expect(screen.getByText('Default')).toBeInTheDocument();
            expect(screen.getByText('Custom Layout 1')).toBeInTheDocument();
        });
    });

    it('should call onSaveLayout when Add Layout is clicked', async () => {
        const onSaveLayout = jest.fn();
        renderWithTheme(<LayoutsMenu {...defaultProps} onSaveLayout={onSaveLayout} />);

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            fireEvent.click(screen.getByText('Add Layout'));
        });

        expect(onSaveLayout).toHaveBeenCalledTimes(1);
    });

    it('should call onLoadLayout with index when layout is clicked', async () => {
        const onLoadLayout = jest.fn();
        renderWithTheme(<LayoutsMenu {...defaultProps} onLoadLayout={onLoadLayout} />);

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            fireEvent.click(screen.getByText('Custom Layout 1'));
        });

        expect(onLoadLayout).toHaveBeenCalledWith(1);
    });

    it('should highlight current layout', async () => {
        renderWithTheme(
            <LayoutsMenu {...defaultProps} currentLayoutName="Custom Layout 1" />
        );

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            const layoutItem = screen.getByText('Custom Layout 1');
            // Check that the text has fontWeight 600 (active state)
            expect(layoutItem).toHaveStyle({fontWeight: 600});
        });
    });
});

describe('ToolbarIconButton', () => {
    const defaultProps = {
        icon: <span data-testid="test-icon">Icon</span>,
        tooltip: 'Test Tooltip',
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render with icon', () => {
        renderWithTheme(<ToolbarIconButton {...defaultProps} />);
        expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithTheme(<ToolbarIconButton {...defaultProps} onClick={onClick} />);

        fireEvent.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when disabled prop is true', () => {
        renderWithTheme(<ToolbarIconButton {...defaultProps} disabled={true} />);
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should not call onClick when disabled', () => {
        const onClick = jest.fn();
        renderWithTheme(
            <ToolbarIconButton {...defaultProps} onClick={onClick} disabled={true} />
        );

        fireEvent.click(screen.getByRole('button'));

        expect(onClick).not.toHaveBeenCalled();
    });
});
