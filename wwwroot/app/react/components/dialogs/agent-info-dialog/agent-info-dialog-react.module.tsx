/**
 * Agent Info Dialog React Module
 *
 * Entry point for the React-based Agent Info Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AgentInfoDialog } from './AgentInfoDialog';
import { AgentInfo } from '../../../interfaces';
import { getTheme } from '../../../theme/muiTheme';
import { agentApi } from '../../../services/agentApi';

interface DialogState {
    open: boolean;
    agent: AgentInfo | null;
    isLoading: boolean;
}

export interface OpenAgentInfoDialogOptions {
    agentId: number;
}

/**
 * Agent Info Dialog Manager Class
 * Manages the lifecycle and state of the Agent Info Dialog.
 */
class AgentInfoDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {
        open: false,
        agent: null,
        isLoading: false,
    };

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-agent-info-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const handleClose = () => {
            this.dialogState.open = false;
            this.dialogState.agent = null;
            this.dialogState.isLoading = false;
            this.renderDialog();
        };

        const currentTheme = getTheme();

        this.dialogRoot.render(
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <AgentInfoDialog
                    open={this.dialogState.open}
                    agent={this.dialogState.agent}
                    isLoading={this.dialogState.isLoading}
                    onClose={handleClose}
                />
            </ThemeProvider>
        );
    }

    async open(options: OpenAgentInfoDialogOptions): Promise<void> {
        this.initializeDialogRoot();

        this.dialogState = {
            open: true,
            agent: null,
            isLoading: true,
        };
        this.renderDialog();

        try {
            const agent = await agentApi.getAgentInfo(options.agentId);

            this.dialogState = {
                ...this.dialogState,
                agent,
                isLoading: false,
            };
            this.renderDialog();
        } catch (error) {
            console.error('Error loading agent info:', error);
            this.dialogState = {
                open: false,
                agent: null,
                isLoading: false,
            };
            this.renderDialog();
        }
    }
}

const agentInfoDialogManager = new AgentInfoDialogManager();

export async function openAgentInfoDialog(options: OpenAgentInfoDialogOptions): Promise<void> {
    return agentInfoDialogManager.open(options);
}

// Expose to window for AngularJS access
(window as any).ReactAgentInfoDialog = {
    open: openAgentInfoDialog,
};

// Create AngularJS module
const agentInfoDialogReactModule = (window as any).angular.module(
    'uDispatch.agentInfoDialogReact',
    []
);

console.log('[AgentInfoDialogReact] Module registered');

export default agentInfoDialogReactModule;
