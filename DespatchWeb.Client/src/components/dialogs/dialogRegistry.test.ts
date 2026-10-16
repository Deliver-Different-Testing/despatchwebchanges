import {DIALOG_LABELS, DIALOG_LOADERS, loadDialog, requireDialog, type DialogName} from './dialogRegistry';
import {toastService} from '../../services/toastService';

jest.mock('../../services/toastService', () => ({
    toastService: {showErrorToast: jest.fn()},
}));

const EXPECTED_FUNCTIONS: Record<DialogName, string[]> = {
    EditDateTime: ['showEditTimeDialog', 'showEditDateDialog', 'showEditDateAndTimeDialog', 'setToastService'],
    VoidJobConfirmation: ['open'],
    PriceBreakdown: ['open', 'setToastService'],
    DateRange: ['open'],
    SwapPods: ['open'],
    SplitPricingBreakdown: ['open', 'setToastService'],
    SimplePriceEdit: ['open', 'setToastService'],
    Select: ['showSelectDialog', 'setToastService'],
    EditParcelDimensions: ['showEditParcelDimensionsDialog', 'setToastService'],
    SendPod: ['open'],
    JobFileUpload: ['open', 'setToastService'],
    EditAddress: ['open'],
    AutoComplete: ['open', 'openWithTypes'],
    RestoreConfirm: ['open'],
    RecoveryAgentManagement: ['open'],
    NoteManagement: ['open', 'close'],
    Messaging: ['open'],
    FlightDetails: ['openFlightDetailsDialog'],
    FlightAgentConfirmation: ['openFlightDialog', 'openAgentDialog'],
    EventGroup: ['open'],
    EditAfterhours: ['open'],
    Dispatch: ['open'],
    DashboardSettings: ['open'],
    CustomizePanels: ['open'],
    CreateJob: ['open'],
    ComposeEmail: ['open'],
    BulkPriceUpload: ['open'],
    AgentInfo: ['open'],
    AddEvent: ['open'],
    AccessorialCharges: ['open'],
};

describe('dialogRegistry', () => {
    it('covers every registered dialog with an expectation and a label', () => {
        const names = Object.keys(DIALOG_LOADERS).sort();
        expect(Object.keys(EXPECTED_FUNCTIONS).sort()).toEqual(names);
        expect(Object.keys(DIALOG_LABELS).sort()).toEqual(names);
    });

    it.each(Object.entries(EXPECTED_FUNCTIONS))('loadDialog(%s) resolves to its API', async (name, fns) => {
        const api = await loadDialog(name as DialogName) as Record<string, unknown>;
        for (const fn of fns) expect(typeof api[fn]).toBe('function');
    });

    it('returns the same API object on repeated loads', async () => {
        expect(await loadDialog('Select')).toBe(await loadDialog('Select'));
    });

    describe('requireDialog', () => {
        beforeEach(() => jest.clearAllMocks());

        it('resolves the dialog without toasting', async () => {
            const dialog = {open: jest.fn()};
            await expect(requireDialog('Messaging', async () => dialog as never)).resolves.toBe(dialog);
            expect(toastService.showErrorToast).not.toHaveBeenCalled();
        });

        it('toasts and resolves undefined when the import fails', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            await expect(requireDialog('Messaging', () => Promise.reject(new Error('chunk failed')))).resolves.toBeUndefined();
            expect(toastService.showErrorToast).toHaveBeenCalledWith('Messaging dialog is not loaded.');
        });

        it('toasts when the name is unknown', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            await expect(requireDialog('Nope' as DialogName)).resolves.toBeUndefined();
            expect(toastService.showErrorToast).toHaveBeenCalled();
        });
    });
});
