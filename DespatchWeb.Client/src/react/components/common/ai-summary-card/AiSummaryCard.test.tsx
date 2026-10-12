/**
 * AiSummaryCard tests.
 *
 * Verifies the structured-summary card auto-fetches, renders the verdict,
 * key-facts chips, attention callouts, and timeline pills, and that
 * refresh / copy / stop interactions behave correctly. Queries are by
 * visible text / role to stay resilient to styling changes.
 */

import React from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {AiSummaryCard} from './AiSummaryCard';
import type {StructuredSummaryResponse} from '../../../interfaces/ai';

const renderWithTheme = (ui: React.ReactElement) => renderWithMantine(ui);

function buildSummary(overrides: Partial<StructuredSummaryResponse> = {}): StructuredSummaryResponse {
    return {
        verdict: '🚨 Overdue for delivery — courier stale',
        severity: 'Critical',
        keyFacts: ['Client A', 'Std', 'Akl→Wlg', '$145'],
        attention: [
            {
                headline: 'Delivery 2h past 14:30',
                action: 'Call courier Jim Smith',
                severity: 'Critical',
            },
        ],
        timeline: [
            {label: 'Booked', detail: '4h ago', status: 'Ok'},
            {label: 'Delivery', detail: 'overdue 2h', status: 'Late'},
        ],
        highlights: ['Customer requested call before delivery'],
        usage: {inputTokens: 200, outputTokens: 40},
        ...overrides,
    };
}

describe('AiSummaryCard', () => {
    it('auto-fetches and renders verdict + key facts + attention + timeline', async () => {
        const mockFetch = jest.fn().mockResolvedValue(buildSummary());

        renderWithTheme(<AiSummaryCard title="Auto-mate Job Briefing" fetchSummary={mockFetch} />);

        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        expect(await screen.findByText('🚨 Overdue for delivery — courier stale')).toBeInTheDocument();
        expect(screen.getByText('Client A')).toBeInTheDocument();
        expect(screen.getByText('$145')).toBeInTheDocument();
        expect(screen.getByText('Delivery 2h past 14:30')).toBeInTheDocument();
        expect(screen.getByText('Call courier Jim Smith')).toBeInTheDocument();
        expect(screen.getByText('Booked')).toBeInTheDocument();
        expect(screen.getByText('Delivery')).toBeInTheDocument();
    });

    it('hides Needs Attention section when attention list is empty', async () => {
        const mockFetch = jest.fn().mockResolvedValue(
            buildSummary({attention: [], severity: 'Ok', verdict: '✅ On track'})
        );

        renderWithTheme(<AiSummaryCard title="Auto-mate Job Briefing" fetchSummary={mockFetch} />);

        expect(await screen.findByText('✅ On track')).toBeInTheDocument();
        expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
    });

    it('hides Timeline when empty (e.g. operations summary)', async () => {
        const mockFetch = jest.fn().mockResolvedValue(
            buildSummary({timeline: [], highlights: []})
        );

        renderWithTheme(<AiSummaryCard title="Auto-mate Operations" fetchSummary={mockFetch} />);

        await screen.findByText('🚨 Overdue for delivery — courier stale');
        expect(screen.queryByText('Timeline')).not.toBeInTheDocument();
    });

    it('refresh button re-invokes fetchSummary', async () => {
        const mockFetch = jest.fn().mockResolvedValue(buildSummary());

        renderWithTheme(<AiSummaryCard title="Auto-mate Job Briefing" fetchSummary={mockFetch} />);

        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getByLabelText('Refresh summary'));

        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    });

    it('renders error message when fetch rejects', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new Error('boom'));

        renderWithTheme(<AiSummaryCard title="Auto-mate Job Briefing" fetchSummary={mockFetch} />);

        expect(await screen.findByText('boom')).toBeInTheDocument();
    });

    it('copies a plain-text representation when copy button is clicked', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: {writeText},
        });

        const mockFetch = jest.fn().mockResolvedValue(buildSummary());

        renderWithTheme(<AiSummaryCard title="Auto-mate Job Briefing" fetchSummary={mockFetch} />);

        await screen.findByText('🚨 Overdue for delivery — courier stale');
        fireEvent.click(screen.getByLabelText('Copy briefing'));

        await waitFor(() => expect(writeText).toHaveBeenCalled());
        const copied = writeText.mock.calls[0][0] as string;
        expect(copied).toContain('🚨 Overdue for delivery — courier stale');
        expect(copied).toContain('Client A');
        expect(copied).toContain('Call courier Jim Smith');
    });

    it('reveals highlights when the toggle is activated', async () => {
        const mockFetch = jest.fn().mockResolvedValue(buildSummary());

        renderWithTheme(<AiSummaryCard title="Auto-mate Job Briefing" fetchSummary={mockFetch} />);

        await screen.findByText('🚨 Overdue for delivery — courier stale');
        // Highlights collapsed by default — text exists in collapsed Collapse, so use the toggle
        const toggle = screen.getByText(/Highlights/);
        fireEvent.click(toggle);
        await screen.findByText('Customer requested call before delivery');
    });

    describe('collapsible mode', () => {
        it('starts collapsed and defers the fetch until first expansion', async () => {
            const mockFetch = jest.fn().mockResolvedValue(buildSummary());

            renderWithTheme(
                <AiSummaryCard title="Auto-mate Job Briefing" fetchSummary={mockFetch} collapsible />
            );

            // Body content stays hidden and no fetch fires.
            expect(mockFetch).not.toHaveBeenCalled();
            expect(screen.queryByText('🚨 Overdue for delivery — courier stale')).not.toBeInTheDocument();

            // Clicking the chevron expands and triggers the first fetch.
            fireEvent.click(screen.getByLabelText('Expand Auto-mate briefing'));
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
            expect(await screen.findByText('🚨 Overdue for delivery — courier stale')).toBeInTheDocument();
        });

        it('does not refetch when collapsing and re-expanding', async () => {
            const mockFetch = jest.fn().mockResolvedValue(buildSummary());

            renderWithTheme(
                <AiSummaryCard title="Auto-mate Job Briefing" fetchSummary={mockFetch} collapsible />
            );

            // First expansion → fetch fires once.
            fireEvent.click(screen.getByLabelText('Expand Auto-mate briefing'));
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
            await screen.findByText('🚨 Overdue for delivery — courier stale');

            // Collapse, then expand again — the cached summary stays loaded.
            fireEvent.click(screen.getByLabelText('Collapse Auto-mate briefing'));
            fireEvent.click(screen.getByLabelText('Expand Auto-mate briefing'));
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('starts expanded and fetches on mount when autoOpen is set', async () => {
            const mockFetch = jest.fn().mockResolvedValue(buildSummary());

            renderWithTheme(
                <AiSummaryCard title="Auto-mate Job Briefing" fetchSummary={mockFetch} collapsible autoOpen />
            );

            // No click needed — the card opens and fetches straight away.
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
            expect(await screen.findByText('🚨 Overdue for delivery — courier stale')).toBeInTheDocument();
            expect(screen.getByLabelText('Collapse Auto-mate briefing')).toBeInTheDocument();
        });
    });

    it('shows a stop button while loading and clears it on success', async () => {
        let resolveFetch: (value: StructuredSummaryResponse) => void = () => {};
        const mockFetch = jest.fn(() => new Promise<StructuredSummaryResponse>((resolve) => {
            resolveFetch = resolve;
        }));

        renderWithTheme(<AiSummaryCard title="Auto-mate Job Briefing" fetchSummary={mockFetch} />);

        expect(await screen.findByLabelText('Stop generating')).toBeInTheDocument();

        resolveFetch(buildSummary());
        await waitFor(() =>
            expect(screen.queryByLabelText('Stop generating')).not.toBeInTheDocument()
        );
    });
});
