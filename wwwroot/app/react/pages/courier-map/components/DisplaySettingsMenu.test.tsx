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

        await user.click(screen.getByLabelText('Display settings'));

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

        await user.click(screen.getByLabelText('Display settings'));
        await user.click(screen.getByText('Live'));

        expect(onChange).toHaveBeenCalledWith(LIVE_TEMPLATE);
    });

    it('applies the full Classic template in one click', async () => {
        const user = setupUser();
        const {onChange} = renderMenu(LIVE_TEMPLATE);

        await user.click(screen.getByLabelText('Display settings'));
        await user.click(screen.getByText('Classic'));

        expect(onChange).toHaveBeenCalledWith(CLASSIC_TEMPLATE);
    });

    it('changes only the marker label when the Number option is picked', async () => {
        const user = setupUser();
        const {onChange} = renderMenu(CLASSIC_TEMPLATE);

        await user.click(screen.getByLabelText('Display settings'));
        await user.click(screen.getByText('Number'));

        expect(onChange).toHaveBeenCalledWith({...CLASSIC_TEMPLATE, markerLabel: 'number'});
    });

    it('changes only showJobCount when the switch is toggled', async () => {
        const {onChange} = renderMenu(LIVE_TEMPLATE);
        fireEvent.click(screen.getByLabelText('Display settings'));

        fireEvent.click(screen.getByText('Show job count'));

        expect(onChange).toHaveBeenCalledWith({...LIVE_TEMPLATE, showJobCount: true});
    });

    it('changes only colorMode when "Color by status" is picked', async () => {
        const user = setupUser();
        const {onChange} = renderMenu(LIVE_TEMPLATE);

        await user.click(screen.getByLabelText('Display settings'));
        await user.click(screen.getByText('Color by status'));

        expect(onChange).toHaveBeenCalledWith({...LIVE_TEMPLATE, colorMode: 'status'});
    });

    it("does not render a satellite/roadmap control — that lives in the map's own view picker", async () => {
        const user = setupUser();
        renderMenu(LIVE_TEMPLATE);

        await user.click(screen.getByLabelText('Display settings'));

        expect(screen.queryByText('Satellite')).not.toBeInTheDocument();
        expect(screen.queryByText('Roadmap')).not.toBeInTheDocument();
    });
});
