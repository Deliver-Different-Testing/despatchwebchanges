/**
 * RelatedJobTabs Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {RelatedJobTabs} from './RelatedJobTabs';
import {createMockJob} from '../__testUtils__/mockJob';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('RelatedJobTabs', () => {
    const onTabChange = jest.fn();

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing when there is only one job', () => {
        const {container} = renderWithTheme(
            <RelatedJobTabs
                sortedRelatedJobs={[createMockJob()]}
                selectedTabIndex={0}
                isRecurringJob={false}
                onTabChange={onTabChange}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders tabs for multiple related jobs', () => {
        const jobs = [
            createMockJob({id: 1, jobNo: 'J-001'}),
            createMockJob({id: 2, jobNo: 'J-002'}),
            createMockJob({id: 3, jobNo: 'J-003'}),
        ];
        renderWithTheme(
            <RelatedJobTabs
                sortedRelatedJobs={jobs}
                selectedTabIndex={0}
                isRecurringJob={false}
                onTabChange={onTabChange}
            />
        );

        expect(screen.getByText('J-001')).toBeInTheDocument();
        expect(screen.getByText('J-002')).toBeInTheDocument();
        expect(screen.getByText('J-003')).toBeInTheDocument();
    });

    it('renders synthetic "Job #N" labels for recurring jobs', () => {
        // Recurring booking templates routinely have null UcbkJobNumber, so
        // the parent/suffix policy would just produce blank tabs. The
        // AngularJS template used `Job #{{$index + 1}}` for this case; we
        // restore that here so multi-leg recurring jobs are navigable.
        const jobs = [
            createMockJob({id: 1, jobNo: undefined as unknown as string}),
            createMockJob({id: 2, jobNo: undefined as unknown as string}),
            createMockJob({id: 3, jobNo: 'J-003'}),
        ];
        renderWithTheme(
            <RelatedJobTabs
                sortedRelatedJobs={jobs}
                selectedTabIndex={0}
                isRecurringJob={true}
                onTabChange={onTabChange}
            />
        );

        expect(screen.getByText('Job #1')).toBeInTheDocument();
        expect(screen.getByText('Job #2')).toBeInTheDocument();
        expect(screen.getByText('Job #3')).toBeInTheDocument();
        // The real jobNo, when present, stays on the title attribute only.
        expect(screen.queryByText('J-003')).not.toBeInTheDocument();
    });

    it('abbreviates child tab labels using parent jobNo prefix on non-recurring jobs', () => {
        // Parent KT2103CRT + child KT2103CRTLHP → child renders as '*LHP'.
        // Mirrors the RunViewer Detail panel convention. Only applies to
        // non-recurring jobs — recurring jobs use the synthetic labels above.
        const jobs = [
            createMockJob({id: 1, jobNo: 'KT2103CRT'}),
            createMockJob({id: 2, jobNo: 'KT2103CRTDEL'}),
            createMockJob({id: 3, jobNo: 'KT2103CRTLHP'}),
        ];
        renderWithTheme(
            <RelatedJobTabs
                sortedRelatedJobs={jobs}
                selectedTabIndex={0}
                isRecurringJob={false}
                onTabChange={onTabChange}
            />
        );

        expect(screen.getByText('KT2103CRT')).toBeInTheDocument();
        expect(screen.getByText('*DEL')).toBeInTheDocument();
        expect(screen.getByText('*LHP')).toBeInTheDocument();
        // Full jobNo NOT rendered as a tab label (it lives on the title attr).
        expect(screen.queryByText('KT2103CRTLHP')).not.toBeInTheDocument();
    });

    it('calls onTabChange when a tab is clicked', () => {
        const jobs = [
            createMockJob({id: 1, jobNo: 'J-001'}),
            createMockJob({id: 2, jobNo: 'J-002'}),
        ];
        renderWithTheme(
            <RelatedJobTabs
                sortedRelatedJobs={jobs}
                selectedTabIndex={0}
                isRecurringJob={false}
                onTabChange={onTabChange}
            />
        );

        fireEvent.click(screen.getByText('J-002'));
        expect(onTabChange).toHaveBeenCalledWith(1);
    });
});
