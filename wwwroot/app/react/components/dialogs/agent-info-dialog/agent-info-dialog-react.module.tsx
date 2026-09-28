/**
 * Agent Info Dialog React Module
 *
 * Entry point for the React-based Agent Info Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { AgentInfoDialog } from './AgentInfoDialog';
import { AgentInfo } from '../../../interfaces';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import { agentApi } from '../../../services/agentApi';
import {createDialogHost} from '../../../utils/reactDialogHost';

export interface OpenAgentInfoDialogOptions {
    agentId: number;
}

const host = createDialogHost<{agent: AgentInfo | null; isLoading: boolean}, void>({
    containerId: 'react-agent-info-dialog-root',
    render: ({open, payload, close}) => islandTree(
        <AgentInfoDialog
            open={open}
            agent={payload.agent}
            isLoading={payload.isLoading}
            onClose={() => close()}
        />
    ),
});

export async function openAgentInfoDialog(options: OpenAgentInfoDialogOptions): Promise<void> {
    // The dialog opens on its loading state and is filled in when the agent arrives, so the
    // promise the caller awaits is this function, not the host one.
    void host.open({agent: null, isLoading: true});

    try {
        const agent = await agentApi.getAgentInfo(options.agentId);
        host.update({agent, isLoading: false});
    } catch (error) {
        console.error('Error loading agent info:', error);
        host.close();
    }
}

// Expose to window for AngularJS access
window.ReactAgentInfoDialog = {
    open: openAgentInfoDialog,
};

// Create AngularJS module
const agentInfoDialogReactModule = window.angular!.module(
    'uDispatch.agentInfoDialogReact',
    []
);

console.log('[AgentInfoDialogReact] Module registered');

export default agentInfoDialogReactModule;
