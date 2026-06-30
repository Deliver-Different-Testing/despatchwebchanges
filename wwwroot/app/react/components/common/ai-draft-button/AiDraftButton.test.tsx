import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AiDraftButton} from './AiDraftButton';
import {isAiEnabled} from '../../../../functions/aiSettings';

jest.mock('../../../../functions/aiSettings', () => ({
    isAiEnabled: jest.fn(),
}));

const mockIsAiEnabled = isAiEnabled as jest.Mock;

describe('AiDraftButton', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders nothing when AI is disabled', () => {
        mockIsAiEnabled.mockReturnValue(false);

        const {container} = render(<AiDraftButton onClick={jest.fn()} isDrafting={false} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('renders and fires onClick when AI is enabled', async () => {
        mockIsAiEnabled.mockReturnValue(true);
        const onClick = jest.fn();

        render(<AiDraftButton onClick={onClick} isDrafting={false} />);
        await userEvent.click(screen.getByRole('button', {name: /draft/i}));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('is disabled and shows progress while drafting', () => {
        mockIsAiEnabled.mockReturnValue(true);

        render(<AiDraftButton onClick={jest.fn()} isDrafting={true} />);

        expect(screen.getByRole('button')).toBeDisabled();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('respects the disabled prop', () => {
        mockIsAiEnabled.mockReturnValue(true);

        render(<AiDraftButton onClick={jest.fn()} isDrafting={false} disabled />);

        expect(screen.getByRole('button')).toBeDisabled();
    });
});
