import {screen} from '@testing-library/react';
import {setupUser} from '../../../test/utils/setupUser';

interface CancelHarness {
    onClose: ReturnType<typeof vi.fn>;
    onConfirm: ReturnType<typeof vi.fn>;
}

export function itClosesWithoutConfirmingOnCancel(setup: () => CancelHarness) {
    it('calls onClose when Cancel is clicked', async () => {
        const user = setupUser();
        const {onClose, onConfirm} = setup();

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });
}
