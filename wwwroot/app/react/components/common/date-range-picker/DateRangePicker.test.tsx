
import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import userEvent, {UserEvent} from '@testing-library/user-event';
import dayjs from 'dayjs';
import {DateRangePicker, DateRangePickerProps} from './DateRangePicker';
import {renderWithTheme} from '../../../__testUtils__';

function createDefaultProps(overrides?: Partial<DateRangePickerProps>): DateRangePickerProps {
    return {
        dateSearchRange: 'today',
        fromDate: dayjs('2024-01-01'),
        toDate: dayjs('2024-01-31'),
        onSearchRangeChange: jest.fn(),
        onFromDateChange: jest.fn(),
        onToDateChange: jest.fn(),
        ...overrides,
    };
}

describe('DateRangePicker', () => {
    let user: UserEvent;

    beforeEach(() => {
        user = userEvent.setup();
    });

    it('renders all range toggle buttons', () => {
        renderWithTheme(<DateRangePicker {...createDefaultProps()} />);

        expect(screen.getByRole('button', {name: 'Today'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Fortnight'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Month'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Custom'})).toBeInTheDocument();
    });

    it('does not show date inputs when range is not custom', () => {
        renderWithTheme(<DateRangePicker {...createDefaultProps()} />);

        expect(screen.queryByPlaceholderText('DD/MM/YYYY')).not.toBeInTheDocument();
    });

    it('shows From and To date inputs with formatted values when custom is selected', () => {
        renderWithTheme(<DateRangePicker {...createDefaultProps({dateSearchRange: 'custom'})} />);

        expect(screen.getByText('From')).toBeInTheDocument();
        expect(screen.getByText('To')).toBeInTheDocument();
        expect(screen.getByDisplayValue('01/01/2024')).toBeInTheDocument();
        expect(screen.getByDisplayValue('31/01/2024')).toBeInTheDocument();
    });

    it('calls onSearchRangeChange when a toggle button is clicked', async () => {
        const props = createDefaultProps();
        renderWithTheme(<DateRangePicker {...props} />);

        await user.click(screen.getByRole('button', {name: 'Custom'}));
        expect(props.onSearchRangeChange).toHaveBeenCalledWith('custom');
    });

    it('commits valid date on blur', () => {
        const props = createDefaultProps({dateSearchRange: 'custom'});
        renderWithTheme(<DateRangePicker {...props} />);

        const fromInput = screen.getByDisplayValue('01/01/2024');
        fireEvent.change(fromInput, {target: {value: '15/06/2024'}});
        fireEvent.blur(fromInput);
        expect(props.onFromDateChange).toHaveBeenCalled();
    });

    it('commits valid date on Enter key', () => {
        const props = createDefaultProps({dateSearchRange: 'custom'});
        renderWithTheme(<DateRangePicker {...props} />);

        const toInput = screen.getByDisplayValue('31/01/2024');
        fireEvent.change(toInput, {target: {value: '30/06/2024'}});
        fireEvent.keyDown(toInput, {key: 'Enter'});
        expect(props.onToDateChange).toHaveBeenCalled();
    });

    it('reverts to original value on blur with invalid date', () => {
        const props = createDefaultProps({dateSearchRange: 'custom'});
        renderWithTheme(<DateRangePicker {...props} />);

        const fromInput = screen.getByDisplayValue('01/01/2024');
        fireEvent.change(fromInput, {target: {value: 'not-a-date'}});
        fireEvent.blur(fromInput);
        expect(props.onFromDateChange).not.toHaveBeenCalled();
        expect(fromInput).toHaveValue('01/01/2024');
    });

    it('does not commit to parent while typing (only on blur/Enter)', () => {
        const props = createDefaultProps({dateSearchRange: 'custom'});
        renderWithTheme(<DateRangePicker {...props} />);

        const fromInput = screen.getByDisplayValue('01/01/2024');
        fireEvent.change(fromInput, {target: {value: '15/06/2024'}});
        expect(props.onFromDateChange).not.toHaveBeenCalled();
    });
});
