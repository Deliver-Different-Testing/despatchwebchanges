import {screen, waitFor} from '@testing-library/react';
import {apiClient} from '../../../services/apiClient';
import {clearSessionContext, SessionContextDto} from '../../../session';
import {renderWithProviders} from '../../../__testUtils__';
import {redirectTo} from '../../../utils/navigation';
import {SessionGate} from './SessionGate';

jest.mock('../../../utils/navigation', () => ({redirectTo: jest.fn()}));
jest.mock('../../../services/apiClient', () => ({apiClient: {get: jest.fn()}}));

const get = apiClient.get as jest.Mock;
const dto = {contactId: 5} as SessionContextDto;
const redirect = redirectTo as jest.Mock;

beforeEach(() => {
    get.mockReset();
    redirect.mockReset();
});
afterEach(() => clearSessionContext());

it('shows a spinner, then renders children only after the context loads', async () => {
    let resolve!: (v: SessionContextDto) => void;
    get.mockReturnValue(new Promise(r => (resolve = r)));
    renderWithProviders(<SessionGate><div>app</div></SessionGate>);

    expect(screen.getByLabelText('Loading session')).toBeInTheDocument();
    expect(screen.queryByText('app')).not.toBeInTheDocument();

    resolve(dto);
    expect(await screen.findByText('app')).toBeInTheDocument();
});

it('redirects to the Hub URL from the 401 and renders no children', async () => {
    get.mockRejectedValue({status: 401, statusText: 'Unauthorized', message: 'x', authRedirect: 'https://hub.test/'});
    renderWithProviders(<SessionGate><div>app</div></SessionGate>);

    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://hub.test/'));
    expect(screen.queryByText('app')).not.toBeInTheDocument();
});

it('redirects to / on a 401 without a Hub URL', async () => {
    get.mockRejectedValue({status: 401, statusText: 'Unauthorized', message: 'x'});
    renderWithProviders(<SessionGate><div>app</div></SessionGate>);

    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/'));
});

it('shows an error state with retry on other failures, without redirecting', async () => {
    get.mockRejectedValue({status: 500, statusText: 'Server Error', message: 'x'});
    renderWithProviders(<SessionGate><div>app</div></SessionGate>);

    expect(await screen.findByRole('button', {name: /retry/i})).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
    expect(screen.queryByText('app')).not.toBeInTheDocument();
});

it('renders children straight away from a bootstrap-fetched context without a second request', () => {
    renderWithProviders(<SessionGate initialContext={dto}><div>app</div></SessionGate>);

    expect(screen.getByText('app')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
});
