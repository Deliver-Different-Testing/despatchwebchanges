/**
 * useInboxTriage tests.
 *
 * The behaviour that matters: one call for the whole inbox, never without opt-in,
 * and a failed pass leaves the list exactly as it was.
 */

import {renderHook, waitFor} from '@testing-library/react';
import {useInboxTriage, triageKey} from './useInboxTriage';
import {triageInbox} from '../services/aiAssistantApi';
import {InboxTriageResponse} from '../interfaces/ai';
import {disableAutoMate, enableAutoMate, resetAiPreferences} from '../__testUtils__/aiPreferences';

jest.mock('../services/aiAssistantApi', () => ({
    triageInbox: jest.fn(),
}));


const mockTriage = triageInbox as jest.MockedFunction<typeof triageInbox>;

const response: InboxTriageResponse = {
    conversations: [
        {
            otherPartyId: 4,
            otherPartyType: 0,
            intent: 'Problem',
            urgency: 'Urgent',
            summary: 'Needs gate code for Wiri drop',
            jobReferences: ['J1234'],
            suggestedResponseId: null,
        },
    ],
    usage: {inputTokens: 40, outputTokens: 12},
};

describe('useInboxTriage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetAiPreferences();
        mockTriage.mockResolvedValue(response);
    });

    it('makes exactly one call for the whole inbox and keys it the way the dialog does', async () => {
        const {result} = renderHook(() => useInboxTriage(true, true));

        await waitFor(() => expect(result.current.triage.size).toBe(1));
        expect(mockTriage).toHaveBeenCalledTimes(1);
        expect(result.current.triage.get(triageKey(4, 0))?.summary)
            .toBe('Needs gate code for Wiri drop');
    });

    it('does not call at all without opt-in, an open dialog, or any conversations', async () => {
        disableAutoMate();
        renderHook(() => useInboxTriage(true, true));

        enableAutoMate();
        renderHook(() => useInboxTriage(false, true));
        renderHook(() => useInboxTriage(true, false));

        await waitFor(() => expect(mockTriage).not.toHaveBeenCalled());
    });

    it('does not re-run while the dialog stays open', async () => {
        const {result, rerender} = renderHook(
            ({open}) => useInboxTriage(open, true),
            {initialProps: {open: true}},
        );

        await waitFor(() => expect(result.current.triage.size).toBe(1));
        rerender({open: true});
        rerender({open: true});

        expect(mockTriage).toHaveBeenCalledTimes(1);
    });

    it('runs again on the next open, and clears in between', async () => {
        const {result, rerender} = renderHook(
            ({open}) => useInboxTriage(open, true),
            {initialProps: {open: true}},
        );
        await waitFor(() => expect(result.current.triage.size).toBe(1));

        rerender({open: false});
        expect(result.current.triage.size).toBe(0);

        rerender({open: true});
        await waitFor(() => expect(mockTriage).toHaveBeenCalledTimes(2));
    });

    it('leaves the list untouched when the pass fails', async () => {
        mockTriage.mockRejectedValue(new Error('service down'));

        const {result} = renderHook(() => useInboxTriage(true, true));

        await waitFor(() => expect(result.current.isTriaging).toBe(false));
        expect(result.current.triage.size).toBe(0);
    });
});
