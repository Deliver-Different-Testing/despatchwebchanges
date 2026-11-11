import type {Mock} from 'vitest';
import React from 'react';
import {screen} from '@testing-library/react';
import { setupUser } from '../../../../test/utils/setupUser';
import { renderWithMantine } from '../../../../test/utils';
import {AiDraftButton} from './AiDraftButton';
import {isAiEnabled} from '../../../../utils/aiSettings';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

vi.mock('../../../../utils/aiSettings', () => ({
    isAiEnabled: vi.fn(),
}));

const mockIsAiEnabled = isAiEnabled as Mock;

describe('AiDraftButton (Mantine)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders nothing when AI is disabled', () => {
        mockIsAiEnabled.mockReturnValue(false);

        renderWithMantine(<AiDraftButton onClick={vi.fn()} isDrafting={false} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders and fires onClick when AI is enabled', async () => {
        mockIsAiEnabled.mockReturnValue(true);
        const onClick = vi.fn();

        renderWithMantine(<AiDraftButton onClick={onClick} isDrafting={false} />);
        await userEvent.click(screen.getByRole('button', {name: /draft/i}));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('is disabled and shows the loader while drafting', () => {
        mockIsAiEnabled.mockReturnValue(true);

        renderWithMantine(<AiDraftButton onClick={vi.fn()} isDrafting={true} />);

        expect(screen.getByRole('button')).toHaveAttribute('data-loading', 'true');
        expect(screen.getByText('Drafting…')).toBeInTheDocument();
    });

    it('respects the disabled prop', () => {
        mockIsAiEnabled.mockReturnValue(true);

        renderWithMantine(<AiDraftButton onClick={vi.fn()} isDrafting={false} disabled />);

        expect(screen.getByRole('button')).toBeDisabled();
    });
});
