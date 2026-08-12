
import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {UserEvent} from '@testing-library/user-event';
import dayjs from 'dayjs';
import {DateRangePicker, DateRangePickerProps} from './DateRangePicker';
import { renderWithMantine } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

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

function setUsCustomer(isUs: boolean): void {
    (window as any).serverConfig = {isUSCustomer: isUs};
}

describe('DateRangePicker', () => {
    let user: UserEvent;
    const originalServerConfig = (window as any).serverConfig;

    beforeEach(() => {
        user = setupUser();
        setUsCustomer(false); // NZ format by default; US-specific behaviour has its own block
    });

    afterEach(() => {
        (window as any).serverConfig = originalServerConfig;
    });

    /**
     * The presets are a `SegmentedControl`, so they are radios in one radiogroup —
     * a single tab stop with arrow-key navigation, which the MUI toggle group did
     * not give. Queried by radio role rather than by button.
     */
    it('renders all range presets as one exclusive radio group', () => {
        renderWithMantine(<DateRangePicker {...createDefaultProps()} />);

        expect(screen.getByRole('radio', {name: 'Today'})).toBeChecked();
        for (const label of ['Fortnight', 'Month', 'Custom']) {
            expect(screen.getByRole('radio', {name: label})).not.toBeChecked();
        }
    });

    it('does not show date inputs when range is not custom', () => {
        renderWithMantine(<DateRangePicker {...createDefaultProps()} />);

        expect(screen.queryByPlaceholderText('DD/MM/YYYY')).not.toBeInTheDocument();
    });

    it('shows From and To date inputs with formatted values when custom is selected', () => {
        renderWithMantine(<DateRangePicker {...createDefaultProps({dateSearchRange: 'custom'})} />);

        expect(screen.getByLabelText('From')).toHaveValue('01/01/2024');
        expect(screen.getByLabelText('To')).toHaveValue('31/01/2024');
    });

    it('calls onSearchRangeChange when a preset is clicked', async () => {
        const props = createDefaultProps();
        renderWithMantine(<DateRangePicker {...props} />);

        await user.click(screen.getByRole('radio', {name: 'Custom'}));
        expect(props.onSearchRangeChange).toHaveBeenCalledWith('custom');
    });

    /**
     * `DateInput` commits as soon as the typed text parses, rather than waiting for
     * blur like the hand-rolled field did. That is safe here: the callbacks only
     * move `SearchCriteriaPanel`'s local state — the search itself still fires on
     * Enter or the Search button.
     */
    it('commits a typed date once it parses', () => {
        const props = createDefaultProps({dateSearchRange: 'custom'});
        renderWithMantine(<DateRangePicker {...props} />);

        fireEvent.change(screen.getByLabelText('From'), {target: {value: '15/06/2024'}});
        expect(props.onFromDateChange).toHaveBeenCalled();
    });

    it('parses day-first (NZ) input and commits the correct date', () => {
        const props = createDefaultProps({dateSearchRange: 'custom'});
        renderWithMantine(<DateRangePicker {...props} />);

        fireEvent.change(screen.getByLabelText('To'), {target: {value: '15/06/2024'}}); // 15 June

        const committed = (props.onToDateChange as jest.Mock).mock.calls[0][0] as dayjs.Dayjs;
        expect(committed.format('YYYY-MM-DD')).toBe('2024-06-15');
    });

    /** `fixOnBlur` (the default) is what the old component's manual revert did. */
    it('ignores unparseable text and reverts to the current value on blur', () => {
        const props = createDefaultProps({dateSearchRange: 'custom'});
        renderWithMantine(<DateRangePicker {...props} />);

        const fromInput = screen.getByLabelText('From');
        fireEvent.change(fromInput, {target: {value: 'not-a-date'}});
        fireEvent.blur(fromInput);

        expect(props.onFromDateChange).not.toHaveBeenCalled();
        expect(fromInput).toHaveValue('01/01/2024');
    });

    describe('US customer (isUSCustomer=true)', () => {
        beforeEach(() => setUsCustomer(true));

        it('renders month-first placeholder and values', () => {
            renderWithMantine(<DateRangePicker {...createDefaultProps({dateSearchRange: 'custom'})} />);

            expect(screen.getAllByPlaceholderText('MM/DD/YYYY').length).toBe(2);
            expect(screen.getByLabelText('From')).toHaveValue('01/01/2024');
            expect(screen.getByLabelText('To')).toHaveValue('01/31/2024'); // month-first
        });

        it('parses month-first (US) input and commits the correct date', () => {
            const props = createDefaultProps({dateSearchRange: 'custom'});
            renderWithMantine(<DateRangePicker {...props} />);

            fireEvent.change(screen.getByLabelText('From'), {target: {value: '06/15/2024'}}); // June 15

            const committed = (props.onFromDateChange as jest.Mock).mock.calls[0][0] as dayjs.Dayjs;
            expect(committed.format('YYYY-MM-DD')).toBe('2024-06-15');
        });
    });
});
