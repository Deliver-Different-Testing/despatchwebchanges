import React from 'react';
import {screen} from '@testing-library/react';
import {Check} from 'lucide-react';
import {renderWithMantine} from '../../../../__testUtils__';
import {Icon} from '../../../../components/common/icon/Icon';
import {StatCard} from './StatCard';

const renderStatCard = (props = {}) =>
    renderWithMantine(<StatCard value={42} label="Test Label" {...props} />);

describe('StatCard', () => {
    it('should render numeric value', () => {
        renderStatCard();

        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should render string value', () => {
        renderStatCard({value: '$150.00'});

        expect(screen.getByText('$150.00')).toBeInTheDocument();
    });

    /*
     * There used to be a second font assertion here, "should render the value in
     * the mono face", checking `fontFamily: monoFontFamily`. It passed for the
     * wrong reason: muiTheme exports `monoFontFamily = bodyFontFamily`, so the
     * card has never rendered monospace and the test was comparing the body font
     * to itself. Tabular figures are what actually keep a row of stat cards
     * aligned digit-for-digit, so that is the only thing worth pinning.
     */
    it('should render the value with tabular figures so numbers align', () => {
        renderStatCard({value: '$150.00'});

        expect(screen.getByText('$150.00')).toHaveStyle({fontVariantNumeric: 'tabular-nums'});
    });

    it('should render label', () => {
        renderStatCard();

        expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('should render with icon', () => {
        renderStatCard({icon: <Icon lucide={Check} data-testid="stat-icon"/>});

        expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
    });

    it('should apply color to the top bar', () => {
        renderStatCard({color: 'var(--mantine-color-red-6)'});

        // The bar has no text and no role, so it stamps the colour it was given —
        // which also proves the value reached the DOM, where querying a generated
        // class only proved an element existed.
        expect(document.querySelector('[data-stat-accent]'))
            .toHaveAttribute('data-stat-accent', 'var(--mantine-color-red-6)');
    });
});
