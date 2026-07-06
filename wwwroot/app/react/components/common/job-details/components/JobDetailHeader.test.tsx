/**
 * JobDetailHeader Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {JobDetailHeader} from './JobDetailHeader';
import {createMockJob} from '../__testUtils__/mockJob';
import {monoFontFamily} from '../../../../theme/muiTheme';
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
        routes: [],
        onToggleDensity: jest.fn(),
        onToggleEditMode: jest.fn(),
        onResetFieldVisibility: jest.fn(),
        onStatusClick: jest.fn(),
        onPodReport: jest.fn(),
        onPodSpreadsheet: jest.fn(),
        onSendPodEmail: jest.fn(),
        onLockToggle: jest.fn(),
        onRouteChange: jest.fn(),
        ...overrides,
    };
}

describe('JobDetailHeader', () => {
    it('renders job number and status chip', () => {
        renderWithTheme(<JobDetailHeader {...createDefaultProps()} />);
        expect(screen.getByText('J-1001')).toBeInTheDocument();
        expect(screen.getByText('Dispatched')).toBeInTheDocument();
    });

    it('sets the job number in the mono face as an identifier', () => {
        renderWithTheme(<JobDetailHeader {...createDefaultProps()} />);
        expect(screen.getByText('J-1001')).toHaveStyle({fontFamily: monoFontFamily});
    });

    it('hides status chip for prebook/recurring jobs', () => {
        const job = createMockJob({preBook: true});
        renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
        expect(screen.queryByText('Dispatched')).not.toBeInTheDocument();
    });

    it('hides the job-number Typography for prebook/recurring jobs', () => {
        // Recurring booking templates have null UcbkJobNumber in production —
        // the AngularJS template never displayed a number here, so we mirror
        // that. The toolbar buttons must still render so the operator can
        // toggle density / edit mode / lock from the recurring detail panel.
        const job = createMockJob({preBook: true, jobNo: undefined as unknown as string});
        renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
        expect(screen.queryByText('J-1001')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Compact view')).toBeInTheDocument();
        expect(screen.getByLabelText('Show/Hide fields')).toBeInTheDocument();
        expect(screen.getByLabelText('Lock Job')).toBeInTheDocument();
    });

    it('still renders the partner-job chip on a recurring partner job', () => {
        // The chip lives outside the gated jobNo Typography — gating jobNo
        // should not accidentally hide the chip for recurring partner jobs.
        const job = createMockJob({preBook: true, isPartnerJob: true});
        renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
        expect(screen.getByText('Partner Job')).toBeInTheDocument();
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
        fireEvent.click(screen.getByLabelText('Show/Hide fields'));
        expect(onToggleEditMode).toHaveBeenCalledTimes(1);
    });

    it('shows DashboardCustomize icon when not in edit mode', () => {
        renderWithTheme(<JobDetailHeader {...createDefaultProps({isEditMode: false})} />);
        expect(screen.getByTestId('DashboardCustomizeIcon')).toBeInTheDocument();
    });

    it('shows Check icon and "Done editing" tooltip in edit mode', () => {
        renderWithTheme(<JobDetailHeader {...createDefaultProps({isEditMode: true})} />);
        expect(screen.getByLabelText('Done editing')).toBeInTheDocument();
        expect(screen.getByTestId('CheckIcon')).toBeInTheDocument();
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

    describe('dense mode', () => {
        it('renders job number and status in dense mode', () => {
            renderWithTheme(<JobDetailHeader {...createDefaultProps({dense: true, viewDensityLabel: 'Dense'})} />);
            expect(screen.getByText('J-1001')).toBeInTheDocument();
            expect(screen.getByText('Dispatched')).toBeInTheDocument();
        });

        it('toolbar buttons still work in dense mode', () => {
            const onToggleDensity = jest.fn();
            const onToggleEditMode = jest.fn();
            renderWithTheme(
                <JobDetailHeader {...createDefaultProps({dense: true, viewDensityLabel: 'Dense', onToggleDensity, onToggleEditMode})} />
            );
            fireEvent.click(screen.getByLabelText('Normal view'));
            expect(onToggleDensity).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByLabelText('Show/Hide fields'));
            expect(onToggleEditMode).toHaveBeenCalledTimes(1);
        });

        it('POD menu still works in dense mode', () => {
            const onPodReport = jest.fn();
            const job = createMockJob({done: true, preBook: false});
            renderWithTheme(
                <JobDetailHeader {...createDefaultProps({dense: true, viewDensityLabel: 'Dense', job, onPodReport})} />
            );
            expect(screen.getByLabelText('POD Report')).toBeInTheDocument();
            fireEvent.click(screen.getByLabelText('POD Report'));
            fireEvent.click(screen.getByText('Download as PDF'));
            expect(onPodReport).toHaveBeenCalledTimes(1);
        });
    });

    describe('lock/unlock button', () => {
        it('shows "Lock Job" tooltip and unlocked icon when job is not locked', () => {
            const job = createMockJob({locked: false});
            renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
            expect(screen.getByLabelText('Lock Job')).toBeInTheDocument();
        });

        it('shows "Unlock Job" tooltip and locked icon when job is locked', () => {
            const job = createMockJob({locked: true});
            renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
            expect(screen.getByLabelText('Unlock Job')).toBeInTheDocument();
        });

        it('calls onLockToggle when lock button is clicked', () => {
            const onLockToggle = jest.fn();
            renderWithTheme(<JobDetailHeader {...createDefaultProps({onLockToggle})} />);
            const lockBtn = screen.getByLabelText('Lock Job').querySelector('button')
                ?? screen.getByLabelText('Lock Job');
            fireEvent.click(lockBtn);
            expect(onLockToggle).toHaveBeenCalledTimes(1);
        });

        it('applies warning color when job is locked', () => {
            const job = createMockJob({locked: true});
            renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
            const lockBtn = screen.getByLabelText('Unlock Job').querySelector('button')
                ?? screen.getByLabelText('Unlock Job');
            expect(lockBtn).toHaveClass('MuiIconButton-colorWarning');
        });

        it('is always visible regardless of preBook status', () => {
            const job = createMockJob({preBook: true});
            renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
            expect(screen.getByLabelText('Lock Job')).toBeInTheDocument();
        });

        it('shows partner badge and keeps lock toggle interactive for partner jobs', () => {
            // Lock is a LocalOnly field per PartnerJobGate — each tenant manages its own
            // copy. The field-level edit guards handle cross-tenant protection; the lock
            // toggle should remain usable so dispatchers can still pin a job locally.
            const job = createMockJob({locked: true, isPartnerJob: true});
            renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
            expect(screen.getByText('Partner Job')).toBeInTheDocument();
            const lockBtn = screen.getByLabelText('Unlock Job');
            expect(lockBtn).toBeEnabled();
        });

        it('does not show partner badge for non-partner jobs', () => {
            const job = createMockJob({locked: false, isPartnerJob: false});
            renderWithTheme(<JobDetailHeader {...createDefaultProps({job})} />);
            expect(screen.queryByText('Partner Job')).not.toBeInTheDocument();
        });
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
