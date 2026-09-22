import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {BoxHeader} from './BoxHeader';


const renderHeader = (props: Partial<React.ComponentProps<typeof BoxHeader>> = {}) =>
    render(
        <MantineTestProvider>
            <BoxHeader icon="filter_list" title="Filters" {...props} />
        </MantineTestProvider>,
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

describe('BoxHeader hide button', () => {
    it('does not render a hide button when showHideButton is false', () => {
        renderHeader({showHideButton: false, onHide: jest.fn()});
        expect(screen.queryByLabelText(/Hide Filters/)).not.toBeInTheDocument();
    });

    it('renders the hide button when enabled', () => {
        renderHeader({showHideButton: true, onHide: jest.fn()});
        expect(screen.getByLabelText(/Hide Filters/)).toBeInTheDocument();
    });

    it('calls onHide when clicked', () => {
        const onHide = jest.fn();
        renderHeader({showHideButton: true, onHide});

        fireEvent.click(screen.getByLabelText(/Hide Filters/));

        expect(onHide).toHaveBeenCalledTimes(1);
    });
});
