/**
 * AI Summary Panel React Module
 *
 * Exposes window.ReactAiAssistant for AngularJS / hybrid pages to mount
 * AI summary panels. Only the summary panels remain — the chat dialog,
 * courier-suggestion dialog, and late-alert analysis have been removed.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import { AiSummaryPanel } from '../../common/ai-summary-panel/AiSummaryPanel';
import { getTheme } from '../../../theme/muiTheme';
import { summarizeJob, summarizeOperations } from '../../../services/aiAssistantApi';

const panelRoots = new Map<HTMLElement, Root>();

function renderSummaryPanel(container: HTMLElement, jobId: number): void {
    let root = panelRoots.get(container);
    if (!root) {
        root = createRoot(container);
        panelRoots.set(container, root);
    }

    const currentTheme = getTheme();

    root.render(
        <ThemeProvider theme={currentTheme}>
            <AiSummaryPanel
                title="AI Job Summary"
                fetchSummary={(signal) => summarizeJob(jobId, {signal})}
                autoFetch={true}
            />
        </ThemeProvider>
    );
}

function renderOperationsInsightsPanel(container: HTMLElement): void {
    let root = panelRoots.get(container);
    if (!root) {
        root = createRoot(container);
        panelRoots.set(container, root);
    }

    const currentTheme = getTheme();

    root.render(
        <ThemeProvider theme={currentTheme}>
            <AiSummaryPanel
                title="AI Operations Insights"
                fetchSummary={() => summarizeOperations()}
            />
        </ThemeProvider>
    );
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

const aiAssistantDialogReactModule = window.angular!.module(
    'uDispatch.aiAssistantDialogReact',
    []
);

console.log('[AiAssistantDialogReact] Module registered');

export default aiAssistantDialogReactModule;
