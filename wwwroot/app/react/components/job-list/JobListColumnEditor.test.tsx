import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {JobListColumnEditor, JobListColumnEditorProps} from './JobListColumnEditor';
import {availableColumns, DEFAULT_COLUMN_WIDTHS} from './jobListColumns';
import {createProps, renderWithMantine} from '../../__testUtils__';
import {setupUser} from '../../__testUtils__/setupUser';

const userEvent = setupUser();

const defaultProps: JobListColumnEditorProps = {
    columns: availableColumns(false, true),
    hiddenColumns: [],
    columnWidths: {...DEFAULT_COLUMN_WIDTHS},
    onOrderChange: jest.fn(),
    onHiddenChange: jest.fn(),
    onColumnWidthsChange: jest.fn(),
    onReset: jest.fn(),
    onDone: jest.fn(),
};

const createMockProps = (overrides?: Partial<JobListColumnEditorProps>) =>
    createProps(defaultProps, overrides);

describe('JobListColumnEditor', () => {
    it('lists every configurable column but not the locked indicator gutter', () => {
        renderWithMantine(<JobListColumnEditor {...createMockProps()} />);

        expect(screen.getByLabelText('Show Status')).toBeInTheDocument();
        expect(screen.getByLabelText('Show Delivery')).toBeInTheDocument();
        expect(screen.queryByLabelText(/Show priority/i)).not.toBeInTheDocument();
    });

    it('reflects hidden columns and toggles them back on', async () => {
        const onHiddenChange = jest.fn();
        renderWithMantine(
            <JobListColumnEditor {...createMockProps({hiddenColumns: ['client'], onHiddenChange})} />,
        );

        expect(screen.getByLabelText('Show Client')).not.toBeChecked();
        await userEvent.click(screen.getByLabelText('Show Client'));

        expect(onHiddenChange).toHaveBeenCalledWith([]);
    });

    it('hides a visible column', async () => {
        const onHiddenChange = jest.fn();
        renderWithMantine(<JobListColumnEditor {...createMockProps({onHiddenChange})} />);

        await userEvent.click(screen.getByLabelText('Show Speed'));

        expect(onHiddenChange).toHaveBeenCalledWith(['speed']);
    });

    it('reorders with the arrow keys, keeping the locked column leading', () => {
        const onOrderChange = jest.fn();
        renderWithMantine(<JobListColumnEditor {...createMockProps({onOrderChange})} />);

        // 'Time' is the second configurable column; move it up past 'Date'.
        fireEvent.keyDown(screen.getByRole('button', {name: /Reorder Time/}), {key: 'ArrowUp'});

        const order = onOrderChange.mock.calls[0][0] as string[];
        expect(order[0]).toBe('priority');
        expect(order.slice(1, 3)).toEqual(['time', 'date']);
    });

    it('does not reorder past the ends of the list', () => {
        const onOrderChange = jest.fn();
        renderWithMantine(<JobListColumnEditor {...createMockProps({onOrderChange})} />);

        fireEvent.keyDown(screen.getByRole('button', {name: /Reorder Date/}), {key: 'ArrowUp'});
        fireEvent.keyDown(screen.getByRole('button', {name: /Reorder Status/}), {key: 'ArrowDown'});

        expect(onOrderChange).not.toHaveBeenCalled();
    });

    it('sets a width and clamps it to the resize minimum', async () => {
        const onColumnWidthsChange = jest.fn();
        renderWithMantine(<JobListColumnEditor {...createMockProps({onColumnWidthsChange})} />);

        const width = screen.getByLabelText('Delivery width');
        fireEvent.change(width, {target: {value: '300'}});
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith(
            expect.objectContaining({delivery: 300}),
        );

        fireEvent.change(width, {target: {value: '10'}});
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith(
            expect.objectContaining({delivery: 50}),
        );
    });

    it('exposes Reset to defaults and Done', async () => {
        const onReset = jest.fn();
        const onDone = jest.fn();
        renderWithMantine(<JobListColumnEditor {...createMockProps({onReset, onDone})} />);

        await userEvent.click(screen.getByRole('button', {name: /reset to defaults/i}));
        await userEvent.click(screen.getByRole('button', {name: /^done$/i}));

        expect(onReset).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledTimes(1);
    });
});
