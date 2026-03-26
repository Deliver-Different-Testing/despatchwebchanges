/** @jest-environment jest-environment-jsdom */
/**
 * AgentInformation Component Tests
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {AgentInformation} from './AgentInformation';
import {createMockAgent} from '../__testUtils__/mockJob';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('AgentInformation', () => {
    it('renders agent name, contact details, and ranking/rate chips', () => {
        const agent = createMockAgent();
        renderWithTheme(<AgentInformation agent={agent} />);

        expect(screen.getByText('Agent Information')).toBeInTheDocument();
        expect(screen.getByText('Test Agent')).toBeInTheDocument();
        expect(screen.getByText('09 555 6789')).toBeInTheDocument();
        expect(screen.getByText('agent@test.com')).toBeInTheDocument();
        expect(screen.getByText('$50.00')).toBeInTheDocument();
        expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('renders nothing when agent is null', () => {
        const {container} = renderWithTheme(<AgentInformation agent={null as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('omits contact rows when phone/email not provided', () => {
        const agent = createMockAgent({agentPhone: undefined, agentEmail: undefined});
        renderWithTheme(<AgentInformation agent={agent} />);

        expect(screen.getByText('Test Agent')).toBeInTheDocument();
        expect(screen.queryByText('09 555 6789')).not.toBeInTheDocument();
        expect(screen.queryByText('agent@test.com')).not.toBeInTheDocument();
    });

    it('omits ranking chip when not provided', () => {
        const agent = createMockAgent({agentRanking: ''});
        renderWithTheme(<AgentInformation agent={agent} />);

        expect(screen.getByText('Test Agent')).toBeInTheDocument();
        expect(screen.getByText('$50.00')).toBeInTheDocument();
        expect(screen.queryByText('A')).not.toBeInTheDocument();
    });

    it('renders notes section when agent has notes', () => {
        const agent = createMockAgent({agentNotes: 'Requires ID on pickup'});
        renderWithTheme(<AgentInformation agent={agent} />);

        expect(screen.getByText('Notes:')).toBeInTheDocument();
        expect(screen.getByText('Requires ID on pickup')).toBeInTheDocument();
    });
});
