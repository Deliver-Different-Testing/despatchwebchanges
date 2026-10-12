/**
 * MetricCard Component Tests
 */

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {MetricCard} from './MetricCard';
import {renderWithMantine as renderWithTheme} from '../../../../__testUtils__';

describe('MetricCard', () => {
    it('renders label and value', () => {
        renderWithTheme(<MetricCard label="Pricing" value="$45.50" />);
        expect(screen.getByText('Pricing')).toBeInTheDocument();
        expect(screen.getByText('$45.50')).toBeInTheDocument();
    });

    it('renders em dash for empty value', () => {
        renderWithTheme(<MetricCard label="POD Name" value="" />);
        expect(screen.getByText('\u2014')).toBeInTheDocument();
    });

    it('renders the value with tabular figures so numbers align', () => {
        renderWithTheme(<MetricCard label="Pricing" value="$45.50" />);
        expect(screen.getByText('$45.50')).toHaveStyle({fontVariantNumeric: 'tabular-nums'});
    });

    /**
     * The category no longer switches the typeface (the theme's `mono` alias
     * resolved to the body face, so the distinction was invisible); what it does
     * carry is the accent used by the highlight rule and the "has a value"
     * underline.
     */
    it('keys the accent to the metric category', () => {
        const {container} = renderWithTheme(
            <MetricCard label="Pricing" value="$45.50" category="pricing" filled highlight />
        );
        const card = container.querySelector('[style*="--metric-accent"]') as HTMLElement;
        expect(card.style.getPropertyValue('--metric-accent')).toBe('var(--mantine-color-orange-5)');
        expect(card).toHaveStyle({borderTopWidth: '3px', borderTopStyle: 'solid'});
        expect(card.style.borderTopColor).toBe('var(--mantine-color-orange-5)');
    });

    it('renders a clickable button when onClick is provided and not disabled', () => {
        const onClick = jest.fn();
        renderWithTheme(<MetricCard label="Ready" value="09:00 NZDT" onClick={onClick} />);

        const button = screen.getByRole('button');
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not render a button when disabled or no onClick handler', () => {
        const onClick = jest.fn();
        const {unmount} = renderWithTheme(<MetricCard label="Ready" value="09:00" onClick={onClick} disabled />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        unmount();

        renderWithTheme(<MetricCard label="Created" value="09:00" />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows dash as non-value', () => {
        renderWithTheme(<MetricCard label="Follow Up" value="-" />);
        expect(screen.getByText('-')).toBeInTheDocument();
    });

    describe('dense mode', () => {
        it('renders label and value in dense mode', () => {
            renderWithTheme(<MetricCard label="Pricing" value="$45.50" dense />);
            expect(screen.getByText('Pricing')).toBeInTheDocument();
            expect(screen.getByText('$45.50')).toBeInTheDocument();
        });

        it('remains clickable in dense mode', () => {
            const onClick = jest.fn();
            renderWithTheme(<MetricCard label="Ready" value="09:00" onClick={onClick} dense />);
            fireEvent.click(screen.getByRole('button'));
            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it('renders em dash for empty value in dense mode', () => {
            renderWithTheme(<MetricCard label="POD Name" value="" dense />);
            expect(screen.getByText('\u2014')).toBeInTheDocument();
        });
    });
});
