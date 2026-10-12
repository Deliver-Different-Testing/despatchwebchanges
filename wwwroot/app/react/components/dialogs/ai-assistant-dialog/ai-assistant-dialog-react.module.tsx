/**
 * AI Summary Panel React Module
 *
 * Exposes window.ReactAiAssistant so pages can mount
 * AI summary panels. Only the summary panels remain — the chat dialog,
 * courier-suggestion dialog, and late-alert analysis have been removed.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AiSummaryCard } from '../../common/ai-summary-card/AiSummaryCard';
import { summarizeJob, summarizeOperations } from '../../../services/aiAssistantApi';
import {islandTree} from '../../../theme/DfrntMantineProvider';

const panelRoots = new Map<HTMLElement, Root>();

function renderSummaryPanel(container: HTMLElement, jobId: number): void {
    let root = panelRoots.get(container);
    if (!root) {
        root = createRoot(container);
        panelRoots.set(container, root);
    }
    root.render(islandTree(
    <AiSummaryCard
        title="Auto-mate job briefing"
        fetchSummary={(signal) => summarizeJob(jobId, {signal})}
    />

    ));
}

function renderOperationsInsightsPanel(container: HTMLElement): void {
    let root = panelRoots.get(container);
    if (!root) {
        root = createRoot(container);
        panelRoots.set(container, root);
    }
    root.render(islandTree(
        <AiSummaryCard
            title="Auto-mate operations insights"
            fetchSummary={(signal) => summarizeOperations({signal})}
        />
    ));
}

function unmountSummaryPanel(container: HTMLElement): void {
    const root = panelRoots.get(container);
    if (root) {
        root.unmount();
        panelRoots.delete(container);
    }
}

window.ReactAiAssistant = {
    renderSummaryPanel,
    renderOperationsInsightsPanel,
    unmountSummaryPanel,
};
