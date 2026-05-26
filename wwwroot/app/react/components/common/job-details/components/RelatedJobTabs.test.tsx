/** @jest-environment jest-environment-jsdom */
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

    it('uses full jobNo for recurring jobs when siblings do not share a prefix', () => {
        // Label policy (2026-05-26): parent (first) always shows full jobNo;
        // children show '*<suffix>' only if their jobNo starts with the
        // parent's. 'J-001' / 'J-002' don't share a prefix, so both fall
        // back to their full jobNo regardless of the recurring flag.
        const jobs = [
            createMockJob({id: 1, jobNo: 'J-001'}),
            createMockJob({id: 2, jobNo: 'J-002'}),
        ];
        renderWithTheme(
            <RelatedJobTabs
                sortedRelatedJobs={jobs}
                selectedTabIndex={0}
                isRecurringJob={true}
                onTabChange={onTabChange}
            />
        );

        expect(screen.getByText('J-001')).toBeInTheDocument();
        expect(screen.getByText('J-002')).toBeInTheDocument();
        expect(screen.queryByText('Job #1')).not.toBeInTheDocument();
    });

    it('abbreviates child tab labels using parent jobNo prefix', () => {
        // Parent KT2103CRT + child KT2103CRTLHP → child renders as '*LHP'.
        // Mirrors the RunViewer Detail panel convention.
        const jobs = [
            createMockJob({id: 1, jobNo: 'KT2103CRT'}),
            createMockJob({id: 2, jobNo: 'KT2103CRTDEL'}),
            createMockJob({id: 3, jobNo: 'KT2103CRTLHP'}),
        ];
        renderWithTheme(
            <RelatedJobTabs
                sortedRelatedJobs={jobs}
                selectedTabIndex={0}
                isRecurringJob={true}
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
