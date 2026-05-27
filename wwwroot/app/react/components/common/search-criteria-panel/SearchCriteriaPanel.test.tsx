/**
 * SearchCriteriaPanel Component Tests
 *
 * Optimised: tests sharing identical setup consolidated into single renders.
 */

import React from 'react';
import {screen, act} from '@testing-library/react';
import userEvent, {UserEvent} from '@testing-library/user-event';
import dayjs from 'dayjs';
import {SearchCriteriaPanel, SearchCriteriaPanelProps} from './SearchCriteriaPanel';
import {renderWithTheme} from '../../../__testUtils__';

// Mock DateRangePicker to avoid LocalizationProvider/DatePicker complexity
jest.mock('../date-range-picker/DateRangePicker', () => ({
    DateRangePicker: () => <div data-testid="date-range-picker" />,
}));

function createDefaultProps(overrides?: Partial<SearchCriteriaPanelProps>): SearchCriteriaPanelProps {
    return {
        dateSearchRange: 'today',
        fromDate: dayjs('2024-01-01'),
        toDate: dayjs('2024-01-31'),
        onSearchRangeChange: jest.fn(),
        onFromDateChange: jest.fn(),
        onToDateChange: jest.fn(),
        onCriteriaChange: jest.fn(),
        onSearch: jest.fn(),
        onDownload: jest.fn(),
        onClientReport: jest.fn(),
        onUpload: jest.fn(),
        onClientSearch: jest.fn().mockResolvedValue([]),
        onCourierSearch: jest.fn().mockResolvedValue([]),
        onSpeedSearch: jest.fn().mockResolvedValue([]),
        ...overrides,
    };
}

describe('SearchCriteriaPanel', () => {
    let user: UserEvent;

    beforeEach(() => {
        jest.useFakeTimers();
        user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // Helper: MUI Tooltip wraps disabled IconButtons in a <span>, so the button
    // loses its accessible name. Find the button via its icon's data-testid instead.
    const getClientReportButton = () =>
        screen.getByTestId('DescriptionIcon').closest('button')!;

    // ── Rendering: all labels, inputs, buttons, DateRangePicker (single render) ─
    it('renders all section labels, inputs, buttons, and DateRangePicker', () => {
        renderWithTheme(<SearchCriteriaPanel {...createDefaultProps()} />);

        // Section labels (visible without expanding Advanced)
        expect(screen.getByText('Date Range')).toBeInTheDocument();
        expect(screen.getByText('Clients')).toBeInTheDocument();
        expect(screen.getByText('Couriers')).toBeInTheDocument();
        expect(screen.getByText('Speeds')).toBeInTheDocument();
        expect(screen.getByText('Job Number')).toBeInTheDocument();
        expect(screen.getByText('General Search')).toBeInTheDocument();

        // Advanced toggle button present
        expect(screen.getByRole('button', {name: /Advanced/})).toBeInTheDocument();

        // DateRangePicker
        expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();

        // Text inputs (visible without expanding)
        expect(screen.getByPlaceholderText('Enter job number')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Address, name, reference...')).toBeInTheDocument();

        // Advanced fields hidden by default
        expect(screen.queryByPlaceholderText('Enter job ID')).not.toBeVisible();
        expect(screen.queryByPlaceholderText('Enter bulk job ID')).not.toBeVisible();

        // Action buttons
        expect(screen.getByRole('button', {name: 'Search'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Download'})).toBeInTheDocument();
        expect(getClientReportButton()).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Upload Prices'})).toBeInTheDocument();

        // Client Report disabled when no clients selected
        expect(getClientReportButton()).toBeDisabled();
    });

    // ── Text Input Handlers: type and clear all fields (single render) ─
    it('calls onCriteriaChange for all text inputs on type and clear', async () => {
        const props = createDefaultProps();
        renderWithTheme(<SearchCriteriaPanel {...props} />);

        // Expand Advanced section to access Job ID and Bulk Job ID
        await user.click(screen.getByRole('button', {name: /Advanced/}));

        // Job ID
        const jobIdInput = screen.getByPlaceholderText('Enter job ID');
        await user.click(jobIdInput);
        await user.paste('123');
        expect(props.onCriteriaChange).toHaveBeenCalledWith('jobId', 123);
        (props.onCriteriaChange as jest.Mock).mockClear();
        await user.clear(jobIdInput);
        expect(props.onCriteriaChange).toHaveBeenCalledWith('jobId', undefined);

        // Bulk Job ID
        (props.onCriteriaChange as jest.Mock).mockClear();
        const bulkJobIdInput = screen.getByPlaceholderText('Enter bulk job ID');
        await user.click(bulkJobIdInput);
        await user.paste('456');
        expect(props.onCriteriaChange).toHaveBeenCalledWith('bulkJobId', 456);
        (props.onCriteriaChange as jest.Mock).mockClear();
        await user.clear(bulkJobIdInput);
        expect(props.onCriteriaChange).toHaveBeenCalledWith('bulkJobId', undefined);

        // Job Number
        (props.onCriteriaChange as jest.Mock).mockClear();
        const jobNoInput = screen.getByPlaceholderText('Enter job number');
        await user.click(jobNoInput);
        await user.paste('JOB-001');
        expect(props.onCriteriaChange).toHaveBeenLastCalledWith('job', 'JOB-001');
        (props.onCriteriaChange as jest.Mock).mockClear();
        await user.clear(jobNoInput);
        expect(props.onCriteriaChange).toHaveBeenCalledWith('job', undefined);

        // General Search
        (props.onCriteriaChange as jest.Mock).mockClear();
        const wildInput = screen.getByPlaceholderText('Address, name, reference...');
        await user.click(wildInput);
        await user.paste('test query');
        expect(props.onCriteriaChange).toHaveBeenLastCalledWith('wild', 'test query');
        (props.onCriteriaChange as jest.Mock).mockClear();
        await user.clear(wildInput);
        expect(props.onCriteriaChange).toHaveBeenCalledWith('wild', undefined);
    });

    // ── Enter Key triggers search in all fields (single render) ───
    it('Enter key triggers onSearch in all text inputs', async () => {
        const props = createDefaultProps();
        renderWithTheme(<SearchCriteriaPanel {...props} />);

        // Expand Advanced to access Job ID and Bulk Job ID
        await user.click(screen.getByRole('button', {name: /Advanced/}));

        // Job ID
        await user.click(screen.getByPlaceholderText('Enter job ID'));
        await user.keyboard('{Enter}');
        expect(props.onSearch).toHaveBeenCalledTimes(1);

        // Bulk Job ID
        await user.click(screen.getByPlaceholderText('Enter bulk job ID'));
        await user.keyboard('{Enter}');
        expect(props.onSearch).toHaveBeenCalledTimes(2);

        // Job Number
        await user.click(screen.getByPlaceholderText('Enter job number'));
        await user.keyboard('{Enter}');
        expect(props.onSearch).toHaveBeenCalledTimes(3);

        // General Search
        await user.click(screen.getByPlaceholderText('Address, name, reference...'));
        await user.keyboard('{Enter}');
        expect(props.onSearch).toHaveBeenCalledTimes(4);
    });

    // ── Action Buttons: Search, Download, Upload (single render) ────
    it('calls correct handlers for Search, Download, and Upload buttons', async () => {
        const props = createDefaultProps();
        renderWithTheme(<SearchCriteriaPanel {...props} />);

        await user.click(screen.getByRole('button', {name: 'Search'}));
        // Search flushes local dates to AngularJS before triggering search
        expect(props.onFromDateChange).toHaveBeenCalledTimes(1);
        expect(props.onToDateChange).toHaveBeenCalledTimes(1);
        expect(props.onSearch).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('button', {name: 'Download'}));
        expect(props.onDownload).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('button', {name: 'Upload Prices'}));
        expect(props.onUpload).toHaveBeenCalledTimes(1);
    });

    // ── Client Report: enabled when client selected, calls handler (single render) ─
    it('enables Client Report when client selected and calls onClientReport', async () => {
        const props = createDefaultProps({
            onClientSearch: jest.fn().mockResolvedValue([{id: 1, text: 'Acme Corp'}]),
        });
        renderWithTheme(<SearchCriteriaPanel {...props} />);

        // Select a client
        const clientsInput = screen.getByPlaceholderText('Search clients...');
        await user.type(clientsInput, 'ac');
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        const option = await screen.findByRole('option', {name: 'Acme Corp'});
        await user.click(option);

        // Client Report enabled and clickable
        expect(getClientReportButton()).toBeEnabled();
        await user.click(getClientReportButton());
        expect(props.onClientReport).toHaveBeenCalledTimes(1);
    });

    // ── ChipsAutocomplete: search triggers and chip selection (single render) ─
    it('triggers search callbacks on autocomplete input and selects chips', async () => {
        const props = createDefaultProps({
            onClientSearch: jest.fn().mockResolvedValue([
                {id: 1, text: 'Acme Corp'},
                {id: 2, text: 'Beta Inc'},
            ]),
        });
        renderWithTheme(<SearchCriteriaPanel {...props} />);

        // Clients search + select
        await user.type(screen.getByPlaceholderText('Search clients...'), 'ac');
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        expect(props.onClientSearch).toHaveBeenCalledWith('ac');

        const option = await screen.findByRole('option', {name: 'Acme Corp'});
        await user.click(option);
        expect(props.onCriteriaChange).toHaveBeenCalledWith('clients', [{id: 1, text: 'Acme Corp'}]);

        // Couriers search
        await user.type(screen.getByPlaceholderText('Search couriers...'), 'j');
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        expect(props.onCourierSearch).toHaveBeenCalledWith('j');

        // Speeds search
        await user.type(screen.getByPlaceholderText('Search speeds...'), 's');
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        expect(props.onSpeedSearch).toHaveBeenCalledWith('s');
    });

    // ── Advanced section: collapsed by default, toggles open/closed ─
    it('shows Job ID and Bulk Job ID fields when Advanced is expanded', async () => {
        renderWithTheme(<SearchCriteriaPanel {...createDefaultProps()} />);

        // Collapsed by default — fields not visible
        expect(screen.queryByPlaceholderText('Enter job ID')).not.toBeVisible();
        expect(screen.queryByPlaceholderText('Enter bulk job ID')).not.toBeVisible();

        // Click Advanced to expand
        await user.click(screen.getByRole('button', {name: /Advanced/}));

        // Fields now visible
        expect(screen.getByPlaceholderText('Enter job ID')).toBeVisible();
        expect(screen.getByPlaceholderText('Enter bulk job ID')).toBeVisible();
        expect(screen.getByText('Job ID')).toBeVisible();
        expect(screen.getByText('Bulk Job ID')).toBeVisible();
    });

    // ── Mutual exclusivity: Job ID and Bulk Job ID disable each other ─
    it('disables Bulk Job ID when Job ID has a value and vice versa', async () => {
        const props = createDefaultProps();
        renderWithTheme(<SearchCriteriaPanel {...props} />);

        // Expand Advanced
        await user.click(screen.getByRole('button', {name: /Advanced/}));

        const jobIdInput = screen.getByPlaceholderText('Enter job ID') as HTMLInputElement;
        const bulkJobIdInput = screen.getByPlaceholderText('Enter bulk job ID') as HTMLInputElement;

        // Both enabled initially
        expect(jobIdInput).toBeEnabled();
        expect(bulkJobIdInput).toBeEnabled();

        // Type in Job ID — Bulk Job ID becomes disabled
        await user.click(jobIdInput);
        await user.paste('5');
        expect(bulkJobIdInput).toBeDisabled();
        expect(jobIdInput).toBeEnabled();

        // Clear Job ID — both enabled again
        await user.clear(jobIdInput);
        expect(bulkJobIdInput).toBeEnabled();

        // Type in Bulk Job ID — Job ID becomes disabled
        await user.click(bulkJobIdInput);
        await user.paste('99');
        expect(jobIdInput).toBeDisabled();
        expect(bulkJobIdInput).toBeEnabled();
    });
});
