/**
 * SearchCriteriaPanel Component Tests
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

    describe('Rendering', () => {
        it('renders all section labels', () => {
            renderWithTheme(<SearchCriteriaPanel {...createDefaultProps()} />);

            expect(screen.getByText('Date Range')).toBeInTheDocument();
            expect(screen.getByText('Clients')).toBeInTheDocument();
            expect(screen.getByText('Couriers')).toBeInTheDocument();
            expect(screen.getByText('Speeds')).toBeInTheDocument();
            expect(screen.getByText('Job ID')).toBeInTheDocument();
            expect(screen.getByText('Job Number')).toBeInTheDocument();
            expect(screen.getByText('General Search')).toBeInTheDocument();
        });

        it('renders DateRangePicker', () => {
            renderWithTheme(<SearchCriteriaPanel {...createDefaultProps()} />);
            expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
        });

        it('renders 3 text inputs with correct placeholders', () => {
            renderWithTheme(<SearchCriteriaPanel {...createDefaultProps()} />);

            expect(screen.getByPlaceholderText('Enter job ID')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Enter job number')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Address, name, reference...')).toBeInTheDocument();
        });

        it('renders Search, Download, Client Report, Upload Prices buttons', () => {
            renderWithTheme(<SearchCriteriaPanel {...createDefaultProps()} />);

            expect(screen.getByRole('button', {name: 'Search'})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Download'})).toBeInTheDocument();
            // Client Report: disabled IconButton is wrapped in <span> by Tooltip,
            // so query via DescriptionIcon instead of accessible name
            expect(getClientReportButton()).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Upload Prices'})).toBeInTheDocument();
        });
    });

    describe('Text Input Handlers', () => {
        it('calls onCriteriaChange with jobId and Number on input', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            await user.type(screen.getByPlaceholderText('Enter job ID'), '123');

            expect(props.onCriteriaChange).toHaveBeenLastCalledWith('jobId', 123);
        });

        it('calls onCriteriaChange with jobId undefined on clear', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            const input = screen.getByPlaceholderText('Enter job ID');
            await user.type(input, '1');
            (props.onCriteriaChange as jest.Mock).mockClear();
            await user.clear(input);

            expect(props.onCriteriaChange).toHaveBeenCalledWith('jobId', undefined);
        });

        it('calls onCriteriaChange with job field on job number input', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            await user.type(screen.getByPlaceholderText('Enter job number'), 'JOB-001');

            expect(props.onCriteriaChange).toHaveBeenLastCalledWith('job', 'JOB-001');
        });

        it('calls onCriteriaChange with job undefined on clear', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            const input = screen.getByPlaceholderText('Enter job number');
            await user.type(input, 'X');
            (props.onCriteriaChange as jest.Mock).mockClear();
            await user.clear(input);

            expect(props.onCriteriaChange).toHaveBeenCalledWith('job', undefined);
        });

        it('calls onCriteriaChange with wild field on general search input', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            await user.type(screen.getByPlaceholderText('Address, name, reference...'), 'test query');

            expect(props.onCriteriaChange).toHaveBeenLastCalledWith('wild', 'test query');
        });

        it('calls onCriteriaChange with wild undefined on clear', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            const input = screen.getByPlaceholderText('Address, name, reference...');
            await user.type(input, 'X');
            (props.onCriteriaChange as jest.Mock).mockClear();
            await user.clear(input);

            expect(props.onCriteriaChange).toHaveBeenCalledWith('wild', undefined);
        });
    });

    describe('Keyboard — Enter Key Triggers Search', () => {
        it('Enter in Job ID calls onSearch', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            const input = screen.getByPlaceholderText('Enter job ID');
            await user.click(input);
            await user.keyboard('{Enter}');

            expect(props.onSearch).toHaveBeenCalled();
        });

        it('Enter in Job Number calls onSearch', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            const input = screen.getByPlaceholderText('Enter job number');
            await user.click(input);
            await user.keyboard('{Enter}');

            expect(props.onSearch).toHaveBeenCalled();
        });

        it('Enter in General Search calls onSearch', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            const input = screen.getByPlaceholderText('Address, name, reference...');
            await user.click(input);
            await user.keyboard('{Enter}');

            expect(props.onSearch).toHaveBeenCalled();
        });
    });

    describe('Action Buttons', () => {
        it('Search button calls onSearch', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            await user.click(screen.getByRole('button', {name: 'Search'}));

            expect(props.onSearch).toHaveBeenCalledTimes(1);
        });

        it('Download button calls onDownload', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            await user.click(screen.getByRole('button', {name: 'Download'}));

            expect(props.onDownload).toHaveBeenCalledTimes(1);
        });

        it('Upload Prices button calls onUpload', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            await user.click(screen.getByRole('button', {name: 'Upload Prices'}));

            expect(props.onUpload).toHaveBeenCalledTimes(1);
        });

        it('Client Report is disabled when no clients selected', () => {
            renderWithTheme(<SearchCriteriaPanel {...createDefaultProps()} />);

            expect(getClientReportButton()).toBeDisabled();
        });

        it('Client Report is enabled when clients selected and dates exist', async () => {
            const props = createDefaultProps({
                onClientSearch: jest.fn().mockResolvedValue([{id: 1, text: 'Acme Corp'}]),
            });
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            // Type in the clients autocomplete (minInputLength is 2)
            const clientsInput = screen.getByPlaceholderText('Search clients...');
            await user.type(clientsInput, 'ac');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            const option = await screen.findByRole('option', {name: 'Acme Corp'});
            await user.click(option);

            expect(getClientReportButton()).toBeEnabled();
        });

        it('Client Report calls onClientReport when clicked', async () => {
            const props = createDefaultProps({
                onClientSearch: jest.fn().mockResolvedValue([{id: 1, text: 'Acme Corp'}]),
            });
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            // Select a client first to enable the button
            const clientsInput = screen.getByPlaceholderText('Search clients...');
            await user.type(clientsInput, 'ac');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            const option = await screen.findByRole('option', {name: 'Acme Corp'});
            await user.click(option);

            await user.click(getClientReportButton());

            expect(props.onClientReport).toHaveBeenCalledTimes(1);
        });
    });

    describe('ChipsAutocomplete Integration', () => {
        it('typing in Clients field triggers onClientSearch after debounce', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            await user.type(screen.getByPlaceholderText('Search clients...'), 'ac');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            expect(props.onClientSearch).toHaveBeenCalledWith('ac');
        });

        it('selecting a client chip calls onCriteriaChange', async () => {
            const props = createDefaultProps({
                onClientSearch: jest.fn().mockResolvedValue([
                    {id: 1, text: 'Acme Corp'},
                    {id: 2, text: 'Beta Inc'},
                ]),
            });
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            await user.type(screen.getByPlaceholderText('Search clients...'), 'ac');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            const option = await screen.findByRole('option', {name: 'Acme Corp'});
            await user.click(option);

            expect(props.onCriteriaChange).toHaveBeenCalledWith('clients', [{id: 1, text: 'Acme Corp'}]);
        });

        it('typing in Couriers field triggers onCourierSearch', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            // Couriers has minInputLength of 1
            await user.type(screen.getByPlaceholderText('Search couriers...'), 'j');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            expect(props.onCourierSearch).toHaveBeenCalledWith('j');
        });

        it('typing in Speeds field triggers onSpeedSearch', async () => {
            const props = createDefaultProps();
            renderWithTheme(<SearchCriteriaPanel {...props} />);

            // Speeds has minInputLength of 1
            await user.type(screen.getByPlaceholderText('Search speeds...'), 's');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            expect(props.onSpeedSearch).toHaveBeenCalledWith('s');
        });
    });
});
