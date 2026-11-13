import type {DispatchJob} from '../../../types/dispatchJob';
import {screen} from '@testing-library/react';
import {setupUser} from '../../../test/utils/setupUser';

type RenderMenu = (overrides: {currentJob: DispatchJob}) => unknown;

// Accessorials are tenant pricing to manage, not something a partner needs - and the dialog
// renders raw tenant amounts with no NP masking, so the action must not even be reachable.
export function itHidesAccessorialChargesForNetworkPartner(renderMenu: RenderMenu, job: DispatchJob) {
    it('hides Accessorial Charges for a network partner session, shows it otherwise', async () => {
        const user = setupUser();
        const jobWithAccessorials = {...job, accessorialChargeGroupId: 9} as unknown as DispatchJob;

        renderMenu({currentJob: jobWithAccessorials});
        await user.click(screen.getByRole('button', {name: 'Job actions'}));
        expect(screen.getByRole('menuitem', {name: 'Accessorial charges'})).toBeInTheDocument();

        (window as any).IsNetworkPartner = true;
        try {
            renderMenu({currentJob: jobWithAccessorials});
            const [, npMenuButton] = screen.getAllByRole('button', {name: 'Job actions'});
            await user.click(npMenuButton);
            expect(screen.queryByRole('menuitem', {name: 'Accessorial charges'})).not.toBeInTheDocument();
        } finally {
            (window as any).IsNetworkPartner = undefined;
        }
    });
}

// Functions a network partner can't use at all, even on its own jobs (NpCapability table on the server).
export function itHidesActionForNetworkPartner(renderMenu: RenderMenu, job: DispatchJob, label: string) {
    it(`hides "${label}" for a network partner session, shows it otherwise`, async () => {
        const user = setupUser();

        renderMenu({currentJob: job});
        await user.click(screen.getByRole('button', {name: 'Job actions'}));
        expect(screen.getByRole('menuitem', {name: label})).toBeInTheDocument();

        (window as any).IsNetworkPartner = true;
        try {
            renderMenu({currentJob: job});
            const [, npMenuButton] = screen.getAllByRole('button', {name: 'Job actions'});
            await user.click(npMenuButton);
            expect(screen.queryByRole('menuitem', {name: label})).not.toBeInTheDocument();
        } finally {
            (window as any).IsNetworkPartner = undefined;
        }
    });
}
