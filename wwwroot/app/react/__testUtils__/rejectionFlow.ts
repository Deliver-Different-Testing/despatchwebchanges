import {screen, waitFor} from '@testing-library/react';
import type {UserEvent} from '@testing-library/user-event';

/** Types a reason into the open inline rejection input, confirms, and asserts `reject` received it for request 1. */
export async function confirmRejectionWithReason(
    user: UserEvent,
    reject: (...args: never[]) => unknown,
    reason = 'rate too low',
): Promise<void> {
    await user.click(screen.getByLabelText(/Reason for rejection/i));
    await user.paste(reason);
    await user.click(screen.getByRole('button', {name: /Confirm reject/}));

    await waitFor(() => {
        expect(reject).toHaveBeenCalledWith({requestId: 1, rowVersion: undefined, reason});
    });
}
