import {openMessagingDialog} from './messaging-dialog-react.module';
import {clearSessionContext, setSessionContext, SessionContextDto} from '../../../api/session';

const context = (contactId: number): SessionContextDto => ({
    contactId, staffId: null, firstName: 'A', fullName: 'A B', email: null, dispatcher: null,
    timeZone: 'UTC', countryCode: null, isUsTenant: false, currencyCode: 'NZD',
    clientInternal: true, isNetworkPartner: false, visibleFeatures: null, npMapCenter: null, hubUrl: null,
});

describe('openMessagingDialog', () => {
    afterEach(() => clearSessionContext());

    it('opens for a signed-in session and only errors when there is no contact', async () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const showToast = jest.fn();

        setSessionContext(context(42));
        void openMessagingDialog({toastService: {showToast}} as never);
        expect(error).not.toHaveBeenCalledWith(expect.stringContaining('Unable to determine current staff member'));
        expect(showToast).not.toHaveBeenCalled();

        setSessionContext(context(0));
        await openMessagingDialog({toastService: {showToast}} as never);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('Unable to determine current staff member'));
        expect(showToast).toHaveBeenCalledTimes(1);
        error.mockRestore();
    });
});
