/** @jest-environment jest-environment-jsdom */
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

        // Section labels
        expect(screen.getByText('Date Range')).toBeInTheDocument();
        expect(screen.getByText('Clients')).toBeInTheDocument();
        expect(screen.getByText('Couriers')).toBeInTheDocument();
        expect(screen.getByText('Speeds')).toBeInTheDocument();
        expect(screen.getByText('Job ID')).toBeInTheDocument();
        expect(screen.getByText('Job Number')).toBeInTheDocument();
        expect(screen.getByText('General Search')).toBeInTheDocument();

        // DateRangePicker
        expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();

        // Text inputs
        expect(screen.getByPlaceholderText('Enter job ID')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter job number')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Address, name, reference...')).toBeInTheDocument();

        // Action buttons
        expect(screen.getByRole('button', {name: 'Search'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Download'})).toBeInTheDocument();
        expect(getClientReportButton()).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Upload Prices'})).toBeInTheDocument();

        // Client Report disabled when no clients selected
        expect(getClientReportButton()).toBeDisabled();
    });

    // ── Text Input Handlers: type and clear all 3 fields (single render) ─
    it('calls onCriteriaChange for all text inputs on type and clear', async () => {
        const props = createDefaultProps();
        renderWithTheme(<SearchCriteriaPanel {...props} />);

        // Job ID
        const jobIdInput = screen.getByPlaceholderText('Enter job ID');
        await user.click(jobIdInput);
        await user.paste('123');
        expect(props.onCriteriaChange).toHaveBeenLastCalledWith('jobId', 123);
        (props.onCriteriaChange as jest.Mock).mockClear();
        await user.clear(jobIdInput);
        expect(props.onCriteriaChange).toHaveBeenCalledWith('jobId', undefined);

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

    // ── Enter Key triggers search in all 3 fields (single render) ───
    it('Enter key triggers onSearch in all text inputs', async () => {
        const props = createDefaultProps();
        renderWithTheme(<SearchCriteriaPanel {...props} />);

        // Job ID
        await user.click(screen.getByPlaceholderText('Enter job ID'));
        await user.keyboard('{Enter}');
        expect(props.onSearch).toHaveBeenCalledTimes(1);

        // Job Number
        await user.click(screen.getByPlaceholderText('Enter job number'));
        await user.keyboard('{Enter}');
        expect(props.onSearch).toHaveBeenCalledTimes(2);

        // General Search
        await user.click(screen.getByPlaceholderText('Address, name, reference...'));
        await user.keyboard('{Enter}');
        expect(props.onSearch).toHaveBeenCalledTimes(3);
    });

    // ── Action Buttons: Search, Download, Upload (single render) ────
    it('calls correct handlers for Search, Download, and Upload buttons', async () => {
        const props = createDefaultProps();
        renderWithTheme(<SearchCriteriaPanel {...props} />);

        await user.click(screen.getByRole('button', {name: 'Search'}));
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
});
