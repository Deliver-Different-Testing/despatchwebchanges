/**
 * MUI Date Picker Mocks for faster test execution
 *
 * These lightweight mocks replace heavy @mui/x-date-pickers components.
 * They maintain the same API surface but render simple HTML inputs.
 */

import React, {forwardRef} from 'react';

// Helper to create a mock dayjs-like object from a date string
const createMockDayjs = (value: string) => ({
    toISOString: () => value,
    format: () => value,
    isValid: () => !!value,
    valueOf: () => new Date(value).getTime(),
    toDate: () => new Date(value),
    isSame: () => false,
    isBefore: () => false,
    isAfter: () => false,
    add: () => createMockDayjs(value),
    subtract: () => createMockDayjs(value),
});

// Mock DateTimePicker
export const DateTimePicker = forwardRef<HTMLInputElement, any>(
    ({label, value, onChange, slotProps, disabled, minDateTime, maxDateTime, ...props}, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(createMockDayjs(e.target.value));
        };

        const formattedValue = value?.format?.('YYYY-MM-DDTHH:mm') ??
                               (value ? new Date(value).toISOString().slice(0, 16) : '');

        return React.createElement('div', {'data-testid': 'mock-datetime-picker'},
            React.createElement('label', null, label),
            React.createElement('input', {
                ref,
                type: 'datetime-local',
                value: formattedValue,
                onChange: handleChange,
                disabled,
                'aria-label': label,
                ...props
            })
        );
    }
);

// Mock DatePicker - includes grid cells for tests that interact with calendar
export const DatePicker = forwardRef<HTMLInputElement, any>(
    ({label, value, onChange, disabled, open, onOpen, onClose, ...props}, ref) => {
        const [isOpen, setIsOpen] = React.useState(open ?? false);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(createMockDayjs(e.target.value));
        };

        const handleDayClick = (day: number) => {
            const currentValue = value?.format?.('YYYY-MM') ?? new Date().toISOString().slice(0, 7);
            const newDate = `${currentValue}-${String(day).padStart(2, '0')}`;
            onChange?.(createMockDayjs(newDate));
            setIsOpen(false);
            onClose?.();
        };

        const handleOpen = () => {
            setIsOpen(true);
            onOpen?.();
        };

        const formattedValue = value?.format?.('YYYY-MM-DD') ??
                               (value ? new Date(value).toISOString().slice(0, 10) : '');

        // Generate day cells (1-31)
        const dayCells = Array.from({length: 31}, (_, i) => i + 1).map(day =>
            React.createElement('button', {
                key: day,
                role: 'gridcell',
                'aria-label': String(day),
                onClick: () => handleDayClick(day),
                type: 'button',
            }, day)
        );

        return React.createElement('div', {'data-testid': 'mock-date-picker'},
            React.createElement('label', null, label),
            React.createElement('input', {
                ref,
                type: 'text',
                value: formattedValue,
                onChange: handleChange,
                onClick: handleOpen,
                disabled,
                'aria-label': label,
                readOnly: true,
                ...props
            }),
            isOpen && React.createElement('div', {role: 'dialog'},
                React.createElement('div', {role: 'grid'}, dayCells)
            )
        );
    }
);

// Mock TimePicker
export const TimePicker = forwardRef<HTMLInputElement, any>(
    ({label, value, onChange, disabled, ...props}, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(createMockDayjs(`1970-01-01T${e.target.value}`));
        };

        const formattedValue = value?.format?.('HH:mm') ?? '';

        return React.createElement('div', {'data-testid': 'mock-time-picker'},
            React.createElement('label', null, label),
            React.createElement('input', {
                ref,
                type: 'time',
                value: formattedValue,
                onChange: handleChange,
                disabled,
                'aria-label': label,
                ...props
            })
        );
    }
);

// Mock DateCalendar - includes gridcells for day selection
export const DateCalendar = forwardRef<HTMLDivElement, any>(
    ({value, onChange, disabled, ...props}, ref) => {
        const handleDayClick = (day: number) => {
            const currentValue = value?.format?.('YYYY-MM') ?? new Date().toISOString().slice(0, 7);
            const newDate = `${currentValue}-${String(day).padStart(2, '0')}`;
            onChange?.(createMockDayjs(newDate));
        };

        // Generate day cells (1-31) with proper gridcell role
        const dayCells = Array.from({length: 31}, (_, i) => i + 1).map(day =>
            React.createElement('button', {
                key: day,
                role: 'gridcell',
                'aria-label': String(day),
                onClick: () => handleDayClick(day),
                type: 'button',
                disabled,
            }, day)
        );

        return React.createElement('div', {ref, 'data-testid': 'mock-date-calendar'},
            React.createElement('div', {role: 'grid', 'aria-label': 'calendar'}, dayCells)
        );
    }
);

// Mock TimeClock - renders simple time input with listbox role
export const TimeClock = forwardRef<HTMLDivElement, any>(
    ({value, onChange, disabled, ...props}, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(createMockDayjs(`1970-01-01T${e.target.value}`));
        };

        const formattedValue = value?.format?.('HH:mm') ?? '';

        return React.createElement('div', {ref, 'data-testid': 'mock-time-clock', role: 'listbox'},
            React.createElement('input', {
                type: 'time',
                value: formattedValue,
                onChange: handleChange,
                disabled,
                'aria-label': 'time',
                ...props
            })
        );
    }
);

// Mock LocalizationProvider - just passes through children
export const LocalizationProvider: React.FC<{children: React.ReactNode; dateAdapter?: any}> = ({children}) => {
    return React.createElement(React.Fragment, null, children);
};

// Mock AdapterDayjs - no-op class
export class AdapterDayjs {
    constructor(_options?: any) {}
}

// Default export for compatibility
export default {
    DateTimePicker,
    DatePicker,
    TimePicker,
    DateCalendar,
    TimeClock,
    LocalizationProvider,
    AdapterDayjs,
};
