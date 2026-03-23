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

    it('uses numbered labels for recurring jobs', () => {
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

        expect(screen.getByText('Job #1')).toBeInTheDocument();
        expect(screen.getByText('Job #2')).toBeInTheDocument();
        expect(screen.queryByText('J-001')).not.toBeInTheDocument();
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
