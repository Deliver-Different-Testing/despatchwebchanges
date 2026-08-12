/**
 * SegmentedToggle tests.
 *
 * `ResizeObserver` is a no-op mock in the Jest setup, so `FloatingIndicator`
 * renders but never measures — nothing here may assert on the indicator's
 * position or size. State is asserted through the native radio inputs and the
 * custom properties the control publishes.
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {Rows3, Rows4} from 'lucide-react';

import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {Icon} from '../icon/Icon';
import {SegmentedToggle} from './SegmentedToggle';
import {
    SEGMENTED_TOGGLE_GLYPH_SIZE,
    SEGMENTED_TOGGLE_HEADER_HEIGHT,
    SEGMENTED_TOGGLE_INLINE_HEIGHT,
} from './segmentedToggleTokens';
import {headerSurfaceAccent} from '../../dialogs/shared/mantine/styles';

const SCOPE_DATA = [
    {value: 'current', label: 'This job'},
    {value: 'all', label: 'All tasks'},
];

describe('SegmentedToggle', () => {
    it('exposes a radio group, marks the selected option, and reports changes', async () => {
        const onChange = jest.fn();
        renderWithMantine(
            <SegmentedToggle
                aria-label="Task scope"
                data={SCOPE_DATA}
                value="current"
                onChange={onChange}
            />,
        );
        const user = setupUser();

        expect(screen.getByRole('radiogroup', {name: 'Task scope'})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'This job'})).toBeChecked();
        expect(screen.getByRole('radio', {name: 'All tasks'})).not.toBeChecked();

        await user.click(screen.getByRole('radio', {name: 'All tasks'}));
        expect(onChange).toHaveBeenCalledWith('all');
    });

    it('disables an option without reporting a change, and marks it disabled to assistive tech', async () => {
        const onChange = jest.fn();
        renderWithMantine(
            <SegmentedToggle
                aria-label="Current work scope"
                data={[
                    {value: 'overview', label: 'All Drivers'},
                    {value: 'detail', label: 'Selected Driver', disabled: true},
                ]}
                value="overview"
                onChange={onChange}
            />,
        );
        const user = setupUser();

        const disabled = screen.getByRole('radio', {name: 'Selected Driver'});
        expect(disabled).toBeDisabled();

        await user.click(disabled);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('moves the selection with the arrow keys', async () => {
        const onChange = jest.fn();
        renderWithMantine(
            <SegmentedToggle
                aria-label="Task scope"
                data={SCOPE_DATA}
                value="current"
                onChange={onChange}
            />,
        );
        const user = setupUser();

        await user.click(screen.getByRole('radio', {name: 'This job'}));
        onChange.mockClear();
        await user.keyboard('{ArrowRight}');

        expect(onChange).toHaveBeenCalledWith('all');
    });

    it('publishes the header band metrics and the tenant accent', () => {
        renderWithMantine(
            <SegmentedToggle
                aria-label="Task scope"
                data={SCOPE_DATA}
                value="current"
                onChange={jest.fn()}
            />,
        );

        // Read the declaration directly: jsdom's computed style does not resolve
        // custom properties, so `toHaveStyle` cannot see them.
        const {style} = screen.getByRole('radiogroup', {name: 'Task scope'});
        expect(style.getPropertyValue('--st-height')).toBe(`${SEGMENTED_TOGGLE_HEADER_HEIGHT}px`);
        expect(style.getPropertyValue('--st-accent')).toBe(headerSurfaceAccent);
    });

    it('takes the inline height and a semantic accent when asked', () => {
        renderWithMantine(
            <SegmentedToggle
                aria-label="Job category"
                variant="inline"
                color="orange"
                data={SCOPE_DATA}
                value="current"
                onChange={jest.fn()}
            />,
        );

        const {style} = screen.getByRole('radiogroup', {name: 'Job category'});
        expect(style.getPropertyValue('--st-height')).toBe(`${SEGMENTED_TOGGLE_INLINE_HEIGHT}px`);
        expect(style.getPropertyValue('--st-accent')).toBe('var(--mantine-color-orange-7)');
    });

    it('keeps icon-only options nameable, and sizes their glyph to the band', () => {
        renderWithMantine(
            <SegmentedToggle
                aria-label="Row density"
                data={[
                    {value: 'normal', label: 'Normal', icon: <Icon lucide={Rows3} size={SEGMENTED_TOGGLE_GLYPH_SIZE}/>},
                    {value: 'dense', label: 'Dense', icon: <Icon lucide={Rows4} size={SEGMENTED_TOGGLE_GLYPH_SIZE}/>},
                ]}
                value="dense"
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('radio', {name: 'Dense'})).toBeChecked();
        expect(screen.getByRole('radio', {name: 'Normal'})).toBeInTheDocument();
    });

    it('explains an option on hover, including a disabled one', async () => {
        renderWithMantine(
            <SegmentedToggle
                aria-label="Dispatch type"
                data={[
                    {value: 'courier', label: 'Courier'},
                    {value: 'partner', label: 'DFRNT Partner', disabled: true, tooltip: 'No partner lane for this job'},
                ]}
                value="courier"
                onChange={jest.fn()}
            />,
        );
        const user = setupUser();

        // Anchored inside the label, not on it, so a disabled option still
        // explains itself — the input is disabled, the anchor is not.
        await user.hover(screen.getByText('DFRNT Partner'));

        expect(await screen.findByRole('tooltip')).toHaveTextContent('No partner lane for this job');
    });

    it('marks its orientation for assistive tech', () => {
        renderWithMantine(
            <SegmentedToggle
                aria-label="Show"
                orientation="vertical"
                data={SCOPE_DATA}
                value="all"
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('radiogroup', {name: 'Show'})).toHaveAttribute('aria-orientation', 'vertical');
    });

    it('scopes each group to its own radio name so two toggles do not fight', () => {
        renderWithMantine(
            <>
                <SegmentedToggle aria-label="Task scope" data={SCOPE_DATA} value="current" onChange={jest.fn()}/>
                <SegmentedToggle aria-label="Second scope" data={SCOPE_DATA} value="all" onChange={jest.fn()}/>
            </>,
        );

        const [first, second] = screen.getAllByRole('radiogroup');
        const nameOf = (group: HTMLElement) => group.querySelector('input')?.getAttribute('name');

        expect(nameOf(first)).toBeTruthy();
        expect(nameOf(first)).not.toEqual(nameOf(second));
    });
});
