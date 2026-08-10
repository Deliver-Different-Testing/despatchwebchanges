import React from 'react';
import {screen} from '@testing-library/react';
import {CustomizePanelsDialog, CustomizePanelsDialogProps} from './CustomizePanelsDialog';
import type {DashboardBox} from '../dashboard-settings-dialog/DashboardSettingsDialog';
import { createProps, renderWithTheme } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

const mockBoxes: Record<string, DashboardBox> = {
    jobList: {name: 'jobList', title: 'Live Job Data', description: 'The job list', icon: 'filter_list', visible: true},
    map: {name: 'map', title: 'Map', description: 'Driver map', icon: 'map', visible: false},
};

const defaultProps: CustomizePanelsDialogProps = {
    open: true,
    boxes: mockBoxes,
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

        // Each panel row renders its glyph as an MUI SvgIcon.
        const jobListRow = screen.getByText('Live Job Data').closest('li')!;
        const mapRow = screen.getByText('Map').closest('li')!;
        expect(jobListRow.querySelector('svg')).toBeInTheDocument();
        expect(mapRow.querySelector('svg')).toBeInTheDocument();
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

    it('lets every layout be customised, including Default', () => {
        renderWithTheme(<CustomizePanelsDialog {...createMockProps({title: 'Default'})} />);

        expect(screen.getByLabelText('Live Job Data')).toBeEnabled();
        expect(screen.getByRole('button', {name: /save/i})).toBeEnabled();
    });

    it('calls onClose from Cancel', async () => {
        const onClose = jest.fn();
        renderWithTheme(<CustomizePanelsDialog {...createMockProps({onClose})} />);

        await userEvent.click(screen.getByRole('button', {name: /cancel/i}));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

