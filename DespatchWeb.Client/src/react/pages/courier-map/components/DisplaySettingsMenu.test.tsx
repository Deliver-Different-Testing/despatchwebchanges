import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {setupUser} from '../../../__testUtils__/setupUser';
import {renderWithMantine as renderWithTheme} from '../../../__testUtils__';
import {DisplaySettingsMenu} from './DisplaySettingsMenu';
import {CLASSIC_TEMPLATE, LIVE_TEMPLATE} from '../CourierMapDisplaySettings';
import type {CourierMapDisplaySettings} from '../CourierMapDisplaySettings';

function renderMenu(settings: CourierMapDisplaySettings, onChange = jest.fn()) {
    renderWithTheme(<DisplaySettingsMenu settings={settings} onChange={onChange}/>);
    return {onChange};
}

describe('DisplaySettingsMenu', () => {
    it('opens on trigger click and shows the preset, label, job-count and color controls', async () => {
        const user = setupUser();
        renderMenu(LIVE_TEMPLATE);

        await user.click(screen.getByLabelText('Marker settings'));

        expect(screen.getByText('Live')).toBeInTheDocument();
        expect(screen.getByText('Classic')).toBeInTheDocument();
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Number')).toBeInTheDocument();
        expect(screen.getByText('Both')).toBeInTheDocument();
        expect(screen.getByText('Show job count')).toBeInTheDocument();
        expect(screen.getByText('Color by status')).toBeInTheDocument();
        expect(screen.getByText('Single color')).toBeInTheDocument();
    });

    it('applies the full Live template in one click, still overridable afterward', async () => {
        const user = setupUser();
        const {onChange} = renderMenu(CLASSIC_TEMPLATE);

        await user.click(screen.getByLabelText('Marker settings'));
        await user.click(screen.getByText('Live'));

        expect(onChange).toHaveBeenCalledWith(LIVE_TEMPLATE);
    });

    it('applies the full Classic template in one click', async () => {
        const user = setupUser();
        const {onChange} = renderMenu(LIVE_TEMPLATE);

        await user.click(screen.getByLabelText('Marker settings'));
        await user.click(screen.getByText('Classic'));

        expect(onChange).toHaveBeenCalledWith(CLASSIC_TEMPLATE);
    });

    it('changes only the marker label when the Number option is picked', async () => {
        const user = setupUser();
        const {onChange} = renderMenu(CLASSIC_TEMPLATE);

        await user.click(screen.getByLabelText('Marker settings'));
        await user.click(screen.getByText('Number'));

        expect(onChange).toHaveBeenCalledWith({...CLASSIC_TEMPLATE, markerLabel: 'number'});
    });

    it('changes only showJobCount when the switch is toggled', async () => {
        const {onChange} = renderMenu(LIVE_TEMPLATE);
        fireEvent.click(screen.getByLabelText('Marker settings'));

        fireEvent.click(screen.getByText('Show job count'));

        expect(onChange).toHaveBeenCalledWith({...LIVE_TEMPLATE, showJobCount: true});
    });

    it('changes only colorMode when "Color by status" is picked', async () => {
        const user = setupUser();
        const {onChange} = renderMenu(LIVE_TEMPLATE);

        await user.click(screen.getByLabelText('Marker settings'));
        await user.click(screen.getByText('Color by status'));

        expect(onChange).toHaveBeenCalledWith({...LIVE_TEMPLATE, colorMode: 'status'});
    });

    it("does not render a satellite/roadmap control — that lives in the map's own view picker", async () => {
        const user = setupUser();
        renderMenu(LIVE_TEMPLATE);

        await user.click(screen.getByLabelText('Marker settings'));

        expect(screen.queryByText('Satellite')).not.toBeInTheDocument();
        expect(screen.queryByText('Roadmap')).not.toBeInTheDocument();
    });

    describe('custom single color', () => {
        it('shows the flag/text color pickers only when colorMode is single', async () => {
            const user = setupUser();
            renderMenu(LIVE_TEMPLATE);

            await user.click(screen.getByLabelText('Marker settings'));

            expect(screen.getByLabelText('Flag color')).toBeInTheDocument();
            expect(screen.getByLabelText('Text color')).toBeInTheDocument();
        });

        it('hides the color pickers in status mode', async () => {
            const user = setupUser();
            renderMenu(CLASSIC_TEMPLATE);

            await user.click(screen.getByLabelText('Marker settings'));

            expect(screen.queryByLabelText('Flag color')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Text color')).not.toBeInTheDocument();
        });

        it('sets singleColor when the user enters a flag color', async () => {
            const user = setupUser();
            const {onChange} = renderMenu(LIVE_TEMPLATE);

            await user.click(screen.getByLabelText('Marker settings'));
            fireEvent.change(screen.getByLabelText('Flag color'), {target: {value: '#ff00ff'}});

            expect(onChange).toHaveBeenLastCalledWith({...LIVE_TEMPLATE, singleColor: '#ff00ff'});
        });

        it('sets singleTextColor when the user enters a text color', async () => {
            const user = setupUser();
            const {onChange} = renderMenu(LIVE_TEMPLATE);

            await user.click(screen.getByLabelText('Marker settings'));
            fireEvent.change(screen.getByLabelText('Text color'), {target: {value: '#000000'}});

            expect(onChange).toHaveBeenLastCalledWith({...LIVE_TEMPLATE, singleTextColor: '#000000'});
        });

        it('does not show a reset control when no custom color is set', async () => {
            const user = setupUser();
            renderMenu(LIVE_TEMPLATE);

            await user.click(screen.getByLabelText('Marker settings'));

            expect(screen.queryByText('Reset')).not.toBeInTheDocument();
        });

        it('resets both custom colors, leaving the rest of the settings untouched', async () => {
            const user = setupUser();
            const customized: CourierMapDisplaySettings = {
                ...LIVE_TEMPLATE,
                singleColor: '#ff00ff',
                singleTextColor: '#000000',
            };
            const {onChange} = renderMenu(customized);

            await user.click(screen.getByLabelText('Marker settings'));
            await user.click(screen.getByText('Reset'));

            expect(onChange).toHaveBeenCalledWith({...LIVE_TEMPLATE, singleColor: undefined, singleTextColor: undefined});
        });
    });

    describe('marker preview', () => {
        function previewMarkup(): string {
            return document.querySelector('[data-testid="marker-preview"]')!.innerHTML;
        }

        it('shows a live preview in status color mode, reflecting the label and job-count settings', async () => {
            const user = setupUser();
            renderMenu(CLASSIC_TEMPLATE); // status mode, name label, job count shown
            await user.click(screen.getByLabelText('Marker settings'));

            expect(previewMarkup()).toContain('>Dave 4<');
        });

        it('shows a live preview in single-color mode, using the effective flag colors', async () => {
            const user = setupUser();
            renderMenu({...LIVE_TEMPLATE, singleColor: '#ff00ff', singleTextColor: '#000000'});
            await user.click(screen.getByLabelText('Marker settings'));

            // LIVE_TEMPLATE labels by number with no job count.
            expect(previewMarkup()).toContain('>DT4<');
            expect(previewMarkup()).toContain('#ff00ff');
        });

        it('updates the preview text when the marker label mode differs', async () => {
            const user = setupUser();
            renderMenu({...CLASSIC_TEMPLATE, markerLabel: 'both'});
            await user.click(screen.getByLabelText('Marker settings'));

            expect(previewMarkup()).toContain('>DT4 · Dave 4<');
        });

        it('renders the preview larger when markerScale is bigger', async () => {
            const user = setupUser();
            const widthOf = () => Number(/width="(\d+)"/.exec(previewMarkup())![1]);

            renderMenu(CLASSIC_TEMPLATE);
            await user.click(screen.getByLabelText('Marker settings'));
            const baseWidth = widthOf();

            document.body.innerHTML = '';
            const user2 = setupUser();
            renderMenu({...CLASSIC_TEMPLATE, markerScale: 1.5});
            await user2.click(screen.getByLabelText('Marker settings'));

            expect(widthOf()).toBeGreaterThan(baseWidth);
        });
    });

    describe('marker size', () => {
        it('changes markerScale when the size slider is adjusted', async () => {
            const user = setupUser();
            const {onChange} = renderMenu(LIVE_TEMPLATE);

            await user.click(screen.getByLabelText('Marker settings'));
            // Mantine's Slider thumb doesn't expose an accessible name in this version — it's the
            // only slider role in the menu, so query by role alone rather than by a name that never lands.
            screen.getByRole('slider').focus();
            await user.keyboard('{ArrowRight}');

            expect(onChange).toHaveBeenLastCalledWith({...LIVE_TEMPLATE, markerScale: 1.25});
        });
    });
});
