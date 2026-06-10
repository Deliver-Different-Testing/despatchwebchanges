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
                onTabChange={onTabChange}
            />
        );

        expect(screen.getByText('J-001')).toBeInTheDocument();
        expect(screen.getByText('J-002')).toBeInTheDocument();
        expect(screen.getByText('J-003')).toBeInTheDocument();
    });

    it('falls back to synthetic "Job #N" labels when jobNo is missing', () => {
        // Defensive fallback for legacy recurring booking templates from
        // before the 2026-04-08 child-template backfill: those rows have
        // ucbkJobNumber = null, so the parent/suffix policy would produce
        // blank tabs. tabLabel() drops to a synthetic 1-based 'Job #N'
        // for those rows only. Templates with a real jobNo (post-backfill,
        // and all freshly-booked schedule families) use the real number
        // via the abbreviation policy in the next test.
        const jobs = [
            createMockJob({id: 1, jobNo: undefined as unknown as string}),
            createMockJob({id: 2, jobNo: undefined as unknown as string}),
            createMockJob({id: 3, jobNo: undefined as unknown as string}),
        ];
        renderWithTheme(
            <RelatedJobTabs
                sortedRelatedJobs={jobs}
                selectedTabIndex={0}
                onTabChange={onTabChange}
            />
        );

        expect(screen.getByText('Job #1')).toBeInTheDocument();
        expect(screen.getByText('Job #2')).toBeInTheDocument();
        expect(screen.getByText('Job #3')).toBeInTheDocument();
    });

    it('abbreviates child tab labels using parent jobNo prefix', () => {
        // Parent KT2103CRT + child KT2103CRTLHP → child renders as '*LHP'.
        // Mirrors RunViewer's relatedJobTabLabel (homeControl.js ~lines
        // 273-286). Applied to both recurring and non-recurring families
        // since the 2026-06-10 child-template migrations now populate
        // real ucbkJobNumber on every leg.
        const jobs = [
            createMockJob({id: 1, jobNo: 'KT2103CRT'}),
            createMockJob({id: 2, jobNo: 'KT2103CRTDEL'}),
            createMockJob({id: 3, jobNo: 'KT2103CRTLHP'}),
        ];
        renderWithTheme(
            <RelatedJobTabs
                sortedRelatedJobs={jobs}
                selectedTabIndex={0}
                onTabChange={onTabChange}
            />
        );

        expect(screen.getByText('KT2103CRT')).toBeInTheDocument();
        expect(screen.getByText('*DEL')).toBeInTheDocument();
        expect(screen.getByText('*LHP')).toBeInTheDocument();
        // Full child jobNo NOT rendered as a tab label (it lives on the title attr).
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
                onTabChange={onTabChange}
            />
        );

        fireEvent.click(screen.getByText('J-002'));
        expect(onTabChange).toHaveBeenCalledWith(1);
    });
});
