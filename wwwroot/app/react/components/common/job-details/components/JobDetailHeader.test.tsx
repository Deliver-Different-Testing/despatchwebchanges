/** @jest-environment jest-environment-jsdom */
/**
 * JobDetailHeader Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {JobDetailHeader} from './JobDetailHeader';
import {createMockJob} from '../__testUtils__/mockJob';
import dayjs from 'dayjs';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function createDefaultProps(overrides?: Record<string, any>) {
    return {
        job: createMockJob(),
        viewDensityLabel: 'Normal',
        isEditMode: false,
        aiEnabled: false,
        showAiPanel: false,
        onToggleDensity: jest.fn(),
        onToggleEditMode: jest.fn(),
        onResetFieldVisibility: jest.fn(),
        onToggleAiPanel: jest.fn(),
        onStatusClick: jest.fn(),
        onPodReport: jest.fn(),
        onPodSpreadsheet: jest.fn(),
        onSendPodEmail: jest.fn(),
        ...overrides,
    };
}

describe('JobDetailHeader', () => {
    it('renders job number and status chip', () => {
        renderWithTheme(<JobDetailHeader {...createDefaultProps()} />);
        expect(screen.getByText('J-1001')).toBeInTheDocument();
        expect(screen.getByText('Dispatched')).toBeInTheDocument();
    });

    it('hides status chip for prebook/recurring jobs', () => {
        const job = createMockJob({preBook: true});
        renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
        expect(screen.queryByText('Dispatched')).not.toBeInTheDocument();
    });

    it('calls onStatusClick when status chip is clicked', () => {
        const onStatusClick = jest.fn();
        renderWithTheme(<JobDetailHeader {...createDefaultProps({onStatusClick})} />);
        fireEvent.click(screen.getByText('Dispatched'));
        expect(onStatusClick).toHaveBeenCalledTimes(1);
    });

    it('calls toolbar button handlers for density and edit mode', () => {
        const onToggleDensity = jest.fn();
        const onToggleEditMode = jest.fn();
        renderWithTheme(<JobDetailHeader {...createDefaultProps({onToggleDensity, onToggleEditMode})} />);
        fireEvent.click(screen.getByLabelText('Compact view'));
        expect(onToggleDensity).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByLabelText('Customize fields'));
        expect(onToggleEditMode).toHaveBeenCalledTimes(1);
    });

    it('shows "Done editing" tooltip in edit mode', () => {
        renderWithTheme(<JobDetailHeader {...createDefaultProps({isEditMode: true})} />);
        expect(screen.getByLabelText('Done editing')).toBeInTheDocument();
    });

    it('shows reset button only in edit mode', () => {
        const {rerender} = renderWithTheme(
            <JobDetailHeader {...createDefaultProps({isEditMode: false})} />
        );
        expect(screen.queryByLabelText('Reset to default layout')).not.toBeInTheDocument();

        rerender(
            <ThemeProvider theme={theme}>
                <JobDetailHeader {...createDefaultProps({isEditMode: true})} />
            </ThemeProvider>
        );
        expect(screen.getByLabelText('Reset to default layout')).toBeInTheDocument();
    });

    it('calls onResetFieldVisibility when reset button clicked', () => {
        const onResetFieldVisibility = jest.fn();
        renderWithTheme(
            <JobDetailHeader {...createDefaultProps({isEditMode: true, onResetFieldVisibility})} />
        );
        fireEvent.click(screen.getByLabelText('Reset to default layout'));
        expect(onResetFieldVisibility).toHaveBeenCalledTimes(1);
    });

    it('shows/hides AI toggle based on aiEnabled', () => {
        const {unmount} = renderWithTheme(<JobDetailHeader {...createDefaultProps({aiEnabled: true})} />);
        expect(screen.getByLabelText('AI Summary')).toBeInTheDocument();
        unmount();

        renderWithTheme(<JobDetailHeader {...createDefaultProps({aiEnabled: false})} />);
        expect(screen.queryByLabelText('AI Summary')).not.toBeInTheDocument();
    });

    it('shows/hides POD report menu based on job done status', () => {
        const job = createMockJob({done: true, preBook: false});
        const {unmount} = renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
        expect(screen.getByLabelText('POD Report')).toBeInTheDocument();
        unmount();

        const incompleteJob = createMockJob({done: false});
        renderWithTheme(<JobDetailHeader {...createDefaultProps({job: incompleteJob})} />);
        expect(screen.queryByLabelText('POD Report')).not.toBeInTheDocument();
    });

    it('opens POD menu and triggers actions', () => {
        const onPodReport = jest.fn();
        const onPodSpreadsheet = jest.fn();
        const onSendPodEmail = jest.fn();
        const job = createMockJob({done: true, preBook: false});
        renderWithTheme(
            <JobDetailHeader {...createDefaultProps({job, onPodReport, onPodSpreadsheet, onSendPodEmail})} />
        );

        fireEvent.click(screen.getByLabelText('POD Report'));
        fireEvent.click(screen.getByText('Download as PDF'));
        expect(onPodReport).toHaveBeenCalledTimes(1);
    });

    it('applies correct status color variants', () => {
        // Done → success
        const doneJob = createMockJob({done: true});
        const {unmount: u1} = renderWithTheme(<JobDetailHeader {...createDefaultProps({job: doneJob})} />);
        expect(screen.getByText('Dispatched').closest('.MuiChip-root')).toHaveClass('MuiChip-colorSuccess');
        u1();

        // Void → error
        const voidJob = createMockJob({void: true});
        const {unmount: u2} = renderWithTheme(<JobDetailHeader {...createDefaultProps({job: voidJob})} />);
        expect(screen.getByText('Dispatched').closest('.MuiChip-root')).toHaveClass('MuiChip-colorError');
        u2();

        // Undispatched → warning
        const undispatchedJob = createMockJob({dispatchTime: undefined, done: false, void: false});
        const {unmount: u3} = renderWithTheme(<JobDetailHeader {...createDefaultProps({job: undispatchedJob})} />);
        expect(screen.getByText('Dispatched').closest('.MuiChip-root')).toHaveClass('MuiChip-colorWarning');
        u3();

        // Dispatched → primary
        const dispatchedJob = createMockJob({dispatchTime: dayjs(), done: false, void: false});
        renderWithTheme(<JobDetailHeader {...createDefaultProps({job: dispatchedJob})} />);
        expect(screen.getByText('Dispatched').closest('.MuiChip-root')).toHaveClass('MuiChip-colorPrimary');
    });
});
