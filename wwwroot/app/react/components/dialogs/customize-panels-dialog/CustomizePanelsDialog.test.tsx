import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CustomizePanelsDialog, CustomizePanelsDialogProps} from './CustomizePanelsDialog';
import type {DashboardBox} from '../dashboard-settings-dialog/DashboardSettingsDialog';
import {createProps, renderWithTheme} from '../../../__testUtils__';

const mockBoxes: Record<string, DashboardBox> = {
    jobList: {name: 'jobList', title: 'Live Job Data', description: 'The job list', icon: 'filter_list', visible: true},
    map: {name: 'map', title: 'Map', description: 'Driver map', icon: 'map', visible: false},
};

const defaultProps: CustomizePanelsDialogProps = {
    open: true,
    boxes: mockBoxes,
    layoutEditable: true,
    onClose: jest.fn(),
    onSave: jest.fn(),
};

const createMockProps = (overrides?: Partial<CustomizePanelsDialogProps>) =>
    createProps(defaultProps, overrides);

describe('CustomizePanelsDialog', () => {
    it('renders a visibility switch per panel reflecting initial state', () => {
        renderWithTheme(<CustomizePanelsDialog {...createMockProps()} />);

        expect(screen.getByText('Customize panels')).toBeInTheDocument();
        expect(screen.getByLabelText('Live Job Data')).toBeChecked();
        expect(screen.getByLabelText('Map')).not.toBeChecked();
    });

    it("renders each panel's own icon glyph", () => {
        renderWithTheme(<CustomizePanelsDialog {...createMockProps()} />);

        // Material Symbols render the glyph name as ligature text content.
        expect(screen.getByText('filter_list')).toBeInTheDocument();
        expect(screen.getByText('map')).toBeInTheDocument();
    });

    it('toggles a panel and returns the updated boxes on Save', async () => {
        const onSave = jest.fn();
        renderWithTheme(<CustomizePanelsDialog {...createMockProps({onSave})} />);

        await userEvent.click(screen.getByLabelText('Map'));
        await userEvent.click(screen.getByRole('button', {name: /save/i}));

        expect(onSave).toHaveBeenCalledTimes(1);
        const saved = onSave.mock.calls[0][0] as Record<string, DashboardBox>;
        expect(saved.map.visible).toBe(true);
        expect(saved.jobList.visible).toBe(true);
    });

    it('shows the info note and disables Save when the layout is not editable', () => {
        renderWithTheme(<CustomizePanelsDialog {...createMockProps({layoutEditable: false})} />);

        expect(screen.getByText(/only available with a custom layout/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Live Job Data')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: /save/i})).toBeDisabled();
    });

    it('calls onClose from Cancel', async () => {
        const onClose = jest.fn();
        renderWithTheme(<CustomizePanelsDialog {...createMockProps({onClose})} />);

        await userEvent.click(screen.getByRole('button', {name: /cancel/i}));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
