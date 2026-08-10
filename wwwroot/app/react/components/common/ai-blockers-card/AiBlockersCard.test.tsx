import React from 'react';
import {render, screen} from '@testing-library/react';
import {AiBlockersCard} from './AiBlockersCard';
import type {ExtractBlockersResponse} from '../../../interfaces/ai';

const withBlockers: ExtractBlockersResponse = {
    blockers: [
        {tag: 'gate-code-needed', severity: 'Caution', evidence: 'gate code 1234', actionRequired: true},
        {tag: 'call-before-delivery', severity: 'Info', evidence: 'call first', actionRequired: false},
    ],
    summary: '2 blockers: gate-code, call-before',
    severity: 'Caution',
    usage: {inputTokens: 1, outputTokens: 1},
};

const noBlockers: ExtractBlockersResponse = {
    blockers: [],
    summary: 'No blockers to analyse.',
    severity: 'Ok',
    usage: {inputTokens: 1, outputTokens: 1},
};

describe('AiBlockersCard', () => {
    it('renders extracted blocker chips', async () => {
        render(<AiBlockersCard title="Blockers" fetchBlockers={() => Promise.resolve(withBlockers)} />);

        expect(await screen.findByText('gate-code-needed')).toBeInTheDocument();
        expect(screen.getByText('call-before-delivery')).toBeInTheDocument();
    });

    it('shows an empty state when there are no blockers', async () => {
        render(<AiBlockersCard title="Blockers" fetchBlockers={() => Promise.resolve(noBlockers)} />);

        expect(await screen.findByText('No blockers detected in the notes.')).toBeInTheDocument();
    });

    it('surfaces fetch errors', async () => {
        render(<AiBlockersCard title="Blockers" fetchBlockers={() => Promise.reject(new Error('boom'))} />);

        expect(await screen.findByText('boom')).toBeInTheDocument();
    });
});
