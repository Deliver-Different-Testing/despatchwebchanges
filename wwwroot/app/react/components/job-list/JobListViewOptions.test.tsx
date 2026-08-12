/**
 * JobListViewOptions Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithMantine} from '../../__testUtils__';
import {setupUser} from '../../__testUtils__/setupUser';
import {JobListViewOptions} from './JobListViewOptions';
import {PANEL_CONTROL_HOVER} from '../common/panel-controls';
import {SEGMENTED_TOGGLE_HEADER_HEIGHT, SEGMENTED_TOGGLE_INLINE_HEIGHT} from '../common/segmented-toggle';
import type {DensityMode} from '../../interfaces/dispatchJob';

function createDefaultProps(overrides?: Partial<React.ComponentProps<typeof JobListViewOptions>>) {
    return {
        densityMode: 'dense' as DensityMode,
        onDensityModeChange: jest.fn(),
        onResetColumns: jest.fn(),
        loggedInCouriersOnly: false,
        onLoggedInCouriersOnlyChange: jest.fn(),
        showLoggedInSwitch: true,
        ...overrides,
    };
}

describe('JobListViewOptions', () => {
    it('marks the active density, and reports density, reset and switch changes', async () => {
        const props = createDefaultProps();
        renderWithMantine(<JobListViewOptions {...props}/>);
        const user = setupUser();

        // Density is a real radio group, not a row of aria-pressed buttons.
        expect(screen.getByRole('radio', {name: 'Dense'})).toBeChecked();
        expect(screen.getByRole('radio', {name: 'Normal'})).not.toBeChecked();

        await user.click(screen.getByRole('radio', {name: 'Ultra Dense'}));
        expect(props.onDensityModeChange).toHaveBeenCalledWith('ultra-dense');

        await user.click(screen.getByRole('button', {name: 'Reset columns'}));
        expect(props.onResetColumns).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('switch', {name: 'Logged-in only'}));
        expect(props.onLoggedInCouriersOnlyChange).toHaveBeenCalledWith(true);
    });

    it('names each density option on hover, since they render as glyphs only', async () => {
        renderWithMantine(<JobListViewOptions {...createDefaultProps()}/>);
        const user = setupUser();

        // The tooltip anchors to the option's content box, not the visually
        // hidden input, so hover what the operator's pointer actually lands on.
        const optionBody = (name: string) =>
            screen.getByRole('radio', {name}).parentElement!.querySelector('span')!;

        await user.hover(optionBody('Ultra Dense'));
        expect(await screen.findByRole('tooltip')).toHaveTextContent('Ultra Dense');

        await user.hover(optionBody('Normal'));
        expect(await screen.findByRole('tooltip')).toHaveTextContent('Normal');
    });

    it('keeps the switch label beside the track rather than stacking it', () => {
        // Mantine lays the label out in the switch body; the header bar is a
        // nowrap row, so the body must not wrap the text onto its own line.
        renderWithMantine(<JobListViewOptions {...createDefaultProps()}/>);

        const label = screen.getByText('Logged-in only');
        const body = label.closest('.mantine-Switch-body') as HTMLElement;
        expect(body).toHaveStyle({flexWrap: 'nowrap', alignItems: 'center'});
    });

    it('hides the logged-in switch outside dispatch contexts', () => {
        renderWithMantine(<JobListViewOptions {...createDefaultProps({showLoggedInSwitch: false})}/>);
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('washes the header-variant controls with the bar accent and leaves colour to the stylesheet', () => {
        // The panel header is a plain `surface` bar, so the hover has to be a
        // translucent step of the bar's accent — and the colour must stay in the
        // stylesheet, because an inline one outranks Mantine's disabled colour.
        renderWithMantine(<JobListViewOptions {...createDefaultProps({headerVariant: true})}/>);

        const reset = screen.getByRole('button', {name: 'Reset columns'});
        expect(reset.style.getPropertyValue('--ai-hover')).toBe(PANEL_CONTROL_HOVER);
        expect(reset.style.color).toBe('');
    });

    it('puts the density toggle on the header band only in the header variant', () => {
        const {unmount} = renderWithMantine(<JobListViewOptions {...createDefaultProps({headerVariant: true})}/>);
        expect(screen.getByRole('radiogroup', {name: 'Row density'}).style.getPropertyValue('--st-height'))
            .toBe(`${SEGMENTED_TOGGLE_HEADER_HEIGHT}px`);
        unmount();

        renderWithMantine(<JobListViewOptions {...createDefaultProps()}/>);
        expect(screen.getByRole('radiogroup', {name: 'Row density'}).style.getPropertyValue('--st-height'))
            .toBe(`${SEGMENTED_TOGGLE_INLINE_HEIGHT}px`);
    });
});
