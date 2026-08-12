import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {BoxHeader} from './BoxHeader';

const theme = createTheme();

const renderHeader = (props: Partial<React.ComponentProps<typeof BoxHeader>> = {}) =>
    render(
        <MantineTestProvider><ThemeProvider theme={theme}>
            <BoxHeader icon="filter_list" title="Filters" {...props} />
        </ThemeProvider></MantineTestProvider>,
    );

describe('BoxHeader drag handle', () => {
    it('does not render a drag handle when showDragHandle is false', () => {
        renderHeader({showDragHandle: false});
        expect(screen.queryByLabelText(/Reorder Filters/)).not.toBeInTheDocument();
    });

    it('renders the drag handle as a focusable button when enabled', () => {
        renderHeader({showDragHandle: true});
        const handle = screen.getByLabelText(/Reorder Filters/);
        expect(handle.tagName).toBe('BUTTON');
    });

    it('calls onMoveUp / onMoveDown on arrow keys', () => {
        const onMoveUp = jest.fn();
        const onMoveDown = jest.fn();
        renderHeader({showDragHandle: true, onMoveUp, onMoveDown});

        const handle = screen.getByLabelText(/Reorder Filters/);
        fireEvent.keyDown(handle, {key: 'ArrowUp'});
        fireEvent.keyDown(handle, {key: 'ArrowDown'});

        expect(onMoveUp).toHaveBeenCalledTimes(1);
        expect(onMoveDown).toHaveBeenCalledTimes(1);
    });

    it('does not throw on arrow keys at a boundary (handler undefined)', () => {
        renderHeader({showDragHandle: true, onMoveUp: undefined, onMoveDown: undefined});
        const handle = screen.getByLabelText(/Reorder Filters/);
        expect(() => fireEvent.keyDown(handle, {key: 'ArrowUp'})).not.toThrow();
    });

    it('re-focuses the handle and notifies when focusHandleOnMount is set', () => {
        const onHandleFocused = jest.fn();
        renderHeader({showDragHandle: true, focusHandleOnMount: true, onHandleFocused});

        const handle = screen.getByLabelText(/Reorder Filters/);
        expect(handle).toHaveFocus();
        expect(onHandleFocused).toHaveBeenCalledTimes(1);
    });
});
