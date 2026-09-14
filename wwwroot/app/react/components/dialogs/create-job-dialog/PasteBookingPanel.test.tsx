/**
 * PasteBookingPanel tests.
 *
 * The behaviour that matters: nothing renders without opt-in, the panel hands the
 * whole extraction to its owner, and `unresolved` reaches the operator before they
 * look at the filled fields.
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import {PasteBookingPanel} from './PasteBookingPanel';
import {intakeAddressToSearchText} from './jobIntake';
import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {extractJobIntake} from '../../../services/aiAssistantApi';
import {AiIntakeAddress, JobIntakeResponse} from '../../../interfaces/ai';
import {disableAutoMate, enableAutoMate, resetAiPreferences} from '../../../__testUtils__/aiPreferences';

jest.mock('../../../services/aiAssistantApi', () => ({
    extractJobIntake: jest.fn(),
}));


const mockExtract = extractJobIntake as jest.MockedFunction<typeof extractJobIntake>;

const emptyAddress: AiIntakeAddress = {
    addressLine1: '', addressLine2: '', addressLine3: '', addressLine4: '',
    addressLine5: '', addressLine6: '', addressLine7: '', addressLine8: '',
};

function intake(overrides: Partial<JobIntakeResponse> = {}): JobIntakeResponse {
    return {
        pickupAddress: emptyAddress,
        deliveryAddress: emptyAddress,
        client: {text: null, id: null, name: null},
        speed: {text: null, id: null, name: null},
        vehicle: {text: null, id: null, name: null},
        fromContactName: '',
        deliverToContact: '',
        podName: '',
        date: null,
        refA: '',
        refB: '',
        pickupNotes: '',
        deliveryNotes: '',
        jobNotes: '',
        weight: null,
        weightUnit: null,
        confidence: 0.9,
        unresolved: [],
        usage: {inputTokens: 10, outputTokens: 5},
        ...overrides,
    };
}

async function openAndFill(text = 'Collect from Acme tomorrow') {
    const user = setupUser();
    await user.click(screen.getByRole('button', {name: /paste the email or phone note/i}));
    // Mantine's Collapse mounts its content a tick after `expanded` flips, so this
    // has to await rather than query — the sync form passes alone and flakes in a
    // loaded full run.
    await user.type(await screen.findByLabelText(/booking request/i), text);
    await user.click(await screen.findByRole('button', {name: /fill from text/i}));
    return user;
}

describe('PasteBookingPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetAiPreferences();
    });

    it('renders nothing when the user has not opted into Auto-mate', () => {
        disableAutoMate();

        renderWithMantine(<PasteBookingPanel onFilled={jest.fn()}/>);

        expect(screen.queryByText(/paste a booking/i)).not.toBeInTheDocument();
    });

    it('hands the whole extraction to its owner', async () => {
        const onFilled = jest.fn();
        const response = intake({fromContactName: 'Jo', refA: 'PO-1'});
        mockExtract.mockResolvedValue(response);

        renderWithMantine(<PasteBookingPanel onFilled={onFilled}/>);
        await openAndFill();

        await waitFor(() => expect(onFilled).toHaveBeenCalledWith(response));
        expect(mockExtract).toHaveBeenCalledWith(
            {text: 'Collect from Acme tomorrow'},
            expect.objectContaining({signal: expect.anything()}),
        );
    });

    it('shows what a human still has to decide, and not the all-clear', async () => {
        mockExtract.mockResolvedValue(intake({unresolved: ['No delivery suburb given']}));

        renderWithMantine(<PasteBookingPanel onFilled={jest.fn()}/>);
        await openAndFill();

        expect(await screen.findByText('No delivery suburb given')).toBeInTheDocument();
        expect(screen.queryByText(/fields filled below/i)).not.toBeInTheDocument();
    });

    it('flags a low-confidence read even when nothing is unresolved', async () => {
        mockExtract.mockResolvedValue(intake({confidence: 0.2}));

        renderWithMantine(<PasteBookingPanel onFilled={jest.fn()}/>);
        await openAndFill();

        expect(await screen.findByText(/fields filled below/i)).toBeInTheDocument();
        expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
    });

    it('will not send an empty paste', async () => {
        renderWithMantine(<PasteBookingPanel onFilled={jest.fn()}/>);
        const user = setupUser();

        await user.click(screen.getByRole('button', {name: /paste the email or phone note/i}));

        // Mantine's Collapse mounts its content a tick after `expanded` flips.
        expect(await screen.findByRole('button', {name: /fill from text/i})).toBeDisabled();
        expect(mockExtract).not.toHaveBeenCalled();
    });
});

describe('intakeAddressToSearchText', () => {
    it('builds a geocodable line from the street-level parts', () => {
        expect(intakeAddressToSearchText({
            ...emptyAddress,
            addressLine1: 'Acme Ltd',
            addressLine3: '12',
            addressLine4: 'Queen Street',
            addressLine5: 'Newmarket',
            addressLine6: 'Auckland',
            addressLine7: '1023',
        })).toBe('12 Queen Street, Newmarket, Auckland 1023');
    });

    it('leaves out the company name and the access notes, which stop HERE finding the place', () => {
        expect(intakeAddressToSearchText({
            ...emptyAddress,
            addressLine1: 'Acme Ltd',
            addressLine4: 'Queen Street',
            addressLine8: 'rear entrance, code 1234',
        })).toBe('Queen Street');
    });

    it('is empty for an empty or missing address', () => {
        expect(intakeAddressToSearchText(emptyAddress)).toBe('');
        expect(intakeAddressToSearchText(null)).toBe('');
    });
});
