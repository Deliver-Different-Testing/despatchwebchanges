/**
 * AskAutoMateField tests.
 *
 * The contract: it fills and never searches, and nothing the server could not
 * place is dropped silently.
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import {AskAutoMateField} from './AskAutoMateField';
import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {parseSearchQuery} from '../../../services/aiAssistantApi';
import {SearchCriteriaResponse} from '../../../interfaces/ai';
import {disableAutoMate, enableAutoMate, resetAiPreferences} from '../../../__testUtils__/aiPreferences';

jest.mock('../../../services/aiAssistantApi', () => ({
    parseSearchQuery: jest.fn(),
}));


const mockParse = parseSearchQuery as jest.MockedFunction<typeof parseSearchQuery>;

function criteria(overrides: Partial<SearchCriteriaResponse> = {}): SearchCriteriaResponse {
    return {
        clients: [],
        couriers: [],
        speeds: [],
        jobId: null,
        bulkJobId: null,
        jobNumber: null,
        wildcard: null,
        fromDate: null,
        toDate: null,
        ignored: [],
        unmatchedNames: [],
        usage: {inputTokens: 5, outputTokens: 3},
        ...overrides,
    };
}

describe('AskAutoMateField', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetAiPreferences();
    });

    it('renders nothing when the user has not opted into Auto-mate', () => {
        disableAutoMate();

        renderWithMantine(<AskAutoMateField onParsed={jest.fn()}/>);

        expect(screen.queryByLabelText('Ask Auto-mate')).not.toBeInTheDocument();
    });

    it('hands the parsed criteria to its owner', async () => {
        const parsed = criteria({clients: [{id: 11, text: 'Smith & Co'}], fromDate: '2026-09-07'});
        mockParse.mockResolvedValue(parsed);
        const onParsed = jest.fn();
        renderWithMantine(<AskAutoMateField onParsed={onParsed}/>);
        const user = setupUser();

        await user.type(screen.getByLabelText('Ask Auto-mate'), 'Smith last week');
        await user.click(screen.getByRole('button', {name: /fill the search from this/i}));

        await waitFor(() => expect(onParsed).toHaveBeenCalledWith(parsed));
        expect(mockParse).toHaveBeenCalledWith(
            {query: 'Smith last week'},
            expect.objectContaining({signal: expect.anything()}),
        );
    });

    it('shows what it could not place rather than dropping it', async () => {
        mockParse.mockResolvedValue(criteria({
            unmatchedNames: ['Smyth'],
            ignored: [{term: 'late', reason: 'Job state is not a search field'}],
        }));
        renderWithMantine(<AskAutoMateField onParsed={jest.fn()}/>);
        const user = setupUser();

        await user.type(screen.getByLabelText('Ask Auto-mate'), 'Smyth late');
        await user.click(screen.getByRole('button', {name: /fill the search from this/i}));

        expect(await screen.findByText('No match for "Smyth"')).toBeInTheDocument();
        expect(screen.getByText('"late" — Job state is not a search field')).toBeInTheDocument();
    });

    it('says plainly that the dispatcher still presses Search', () => {
        renderWithMantine(<AskAutoMateField onParsed={jest.fn()}/>);

        expect(screen.getByText(/you still press search/i)).toBeInTheDocument();
    });

    it('will not ask on an empty query', async () => {
        renderWithMantine(<AskAutoMateField onParsed={jest.fn()}/>);

        expect(screen.getByRole('button', {name: /fill the search from this/i})).toBeDisabled();
        expect(mockParse).not.toHaveBeenCalled();
    });

    it('asks on Enter without letting the panel fire its own search', async () => {
        mockParse.mockResolvedValue(criteria());
        renderWithMantine(<AskAutoMateField onParsed={jest.fn()}/>);
        const user = setupUser();

        await user.type(screen.getByLabelText('Ask Auto-mate'), 'Acme{Enter}');

        await waitFor(() => expect(mockParse).toHaveBeenCalledTimes(1));
    });
});
