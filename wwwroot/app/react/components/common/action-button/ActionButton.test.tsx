/**
 * ActionButton tests.
 *
 * The chip's surface lives in a CSS module, which Jest mocks to `{}` — so the
 * visuals are asserted through the custom properties the button publishes and
 * the `data-*`/ARIA state the module's selectors key off.
 */

import React from 'react';
import {screen} from '@testing-library/react';

import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {ActionButton} from './ActionButton';
import {ACTION_BUTTON_COMPACT_HEIGHT, ACTION_BUTTON_HEIGHT} from './actionButtonTokens';
import {headerSurfaceAccent} from '../../dialogs/shared/mantine/styles';

const userEvent = setupUser();

describe('ActionButton', () => {
    it('renders its label, fires clicks, and sizes itself to the control band', async () => {
        const onClick = jest.fn();
        renderWithMantine(<ActionButton onClick={onClick}>Clear</ActionButton>);

        const button = screen.getByRole('button', {name: 'Clear'});
        await userEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);

        // Read the declaration directly: jsdom's computed style does not resolve
        // custom properties, so `toHaveStyle` cannot see them.
        expect(button.style.getPropertyValue('--ab-height')).toBe(`${ACTION_BUTTON_HEIGHT}px`);
        expect(button.style.getPropertyValue('--ab-accent')).toBe(headerSurfaceAccent);
    });

    it('stays a plain action button until it is given a selected state', () => {
        renderWithMantine(<ActionButton>Clear</ActionButton>);

        const button = screen.getByRole('button', {name: 'Clear'});
        expect(button).not.toHaveAttribute('aria-pressed');
        expect(button).not.toHaveAttribute('data-selected');
    });

    it('marks a toggle as pressed for assistive tech and for the selected styling', () => {
        const {rerender} = renderWithMantine(
            <ActionButton selected={false}>Auckland</ActionButton>,
        );

        expect(screen.getByRole('button', {name: 'Auckland', pressed: false})).not.toHaveAttribute('data-selected');

        rerender(<ActionButton selected>Auckland</ActionButton>);
        expect(screen.getByRole('button', {name: 'Auckland', pressed: true})).toHaveAttribute('data-selected');
    });

    it('offers a filled gear for the one primary action on a bar', () => {
        const {rerender} = renderWithMantine(<ActionButton>Restore</ActionButton>);

        expect(screen.getByRole('button', {name: 'Restore'})).toHaveAttribute('data-ab-variant', 'chip');

        rerender(<ActionButton variant="filled">Dispatch</ActionButton>);
        const filled = screen.getByRole('button', {name: 'Dispatch'});
        expect(filled).toHaveAttribute('data-ab-variant', 'filled');
        // Both gears share one definition of the control band.
        expect(filled.style.getPropertyValue('--ab-height')).toBe(`${ACTION_BUTTON_HEIGHT}px`);
    });

    it('offers a compact band for controls that sit inside a table row', () => {
        const {rerender} = renderWithMantine(<ActionButton>Assign</ActionButton>);

        expect(screen.getByRole('button', {name: 'Assign'})).toHaveAttribute('data-ab-size', 'default');

        rerender(<ActionButton size="compact">Assign</ActionButton>);
        const compact = screen.getByRole('button', {name: 'Assign'});
        expect(compact).toHaveAttribute('data-ab-size', 'compact');
        expect(compact.style.getPropertyValue('--ab-height')).toBe(`${ACTION_BUTTON_COMPACT_HEIGHT}px`);
    });

    it('takes a semantic accent when the state is not the brand', () => {
        renderWithMantine(<ActionButton color="orange" selected>Unassigned</ActionButton>);

        const {style} = screen.getByRole('button', {name: 'Unassigned'});
        expect(style.getPropertyValue('--ab-accent')).toBe('var(--mantine-color-orange-7)');
    });

    it('forwards its ref and passes the rest of its props through', async () => {
        const ref = React.createRef<HTMLButtonElement>();
        const onClick = jest.fn();
        renderWithMantine(
            <ActionButton ref={ref} disabled aria-label="Restore views" onClick={onClick}>
                Restore
            </ActionButton>,
        );

        const button = screen.getByRole('button', {name: 'Restore views'});
        expect(ref.current).toBe(button);
        expect(button).toBeDisabled();

        await userEvent.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });
});
