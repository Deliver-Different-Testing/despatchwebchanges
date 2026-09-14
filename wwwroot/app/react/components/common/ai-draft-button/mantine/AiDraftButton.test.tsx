import React from 'react';
import {screen} from '@testing-library/react';
import { setupUser } from '../../../../__testUtils__/setupUser';
import { renderWithMantine } from '../../../../__testUtils__';
import {AiDraftButton} from './AiDraftButton';
import {disableAutoMate, enableAutoMate, resetAiPreferences} from '../../../../__testUtils__/aiPreferences';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();



describe('AiDraftButton (Mantine)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders nothing when AI is disabled', () => {
        disableAutoMate();

        renderWithMantine(<AiDraftButton onClick={jest.fn()} isDrafting={false} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders and fires onClick when AI is enabled', async () => {
        enableAutoMate();
        const onClick = jest.fn();

        renderWithMantine(<AiDraftButton onClick={onClick} isDrafting={false} />);
        await userEvent.click(screen.getByRole('button', {name: /draft/i}));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('is disabled and shows the loader while drafting', () => {
        enableAutoMate();

        renderWithMantine(<AiDraftButton onClick={jest.fn()} isDrafting={true} />);

        expect(screen.getByRole('button')).toHaveAttribute('data-loading', 'true');
        expect(screen.getByText('Drafting…')).toBeInTheDocument();
    });

    it('respects the disabled prop', () => {
        enableAutoMate();

        renderWithMantine(<AiDraftButton onClick={jest.fn()} isDrafting={false} disabled />);

        expect(screen.getByRole('button')).toBeDisabled();
    });
});
