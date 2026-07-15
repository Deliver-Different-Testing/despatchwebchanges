/** @jest-environment jest-fixed-jsdom */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../__testUtils__/msw/setupIntegration';
import { mockClearListDebug } from '../../../../__testUtils__/msw/handlers';
import { ClearListDebugButton } from '../ClearListDebugDialog';
import { renderWithTheme } from '../../../../__testUtils__';
import { setupUser } from '../../../../__testUtils__/setupUser';

describe('ClearListDebugDialog integration', () => {
    it('fetches and renders debug data via apiClient through MSW', async () => {
        const user = setupUser();
        renderWithTheme(<ClearListDebugButton courierId={42} />);

        await user.click(screen.getByRole('button'));

        expect(await screen.findByText('Clear List Debug')).toBeInTheDocument();
        expect(screen.getByText('C042')).toBeInTheDocument();
        expect(screen.getByText('Test Driver')).toBeInTheDocument();
        expect(screen.getByText('Zone A')).toBeInTheDocument();
        expect(screen.getByText('Driver is in Zone A, assigned to North Area.')).toBeInTheDocument();
    });

    it('passes courierId as a query parameter', async () => {
        const user = setupUser();
        let capturedUrl = '';

        server.use(
            http.get('*/courier/ClearListDebug', ({ request }) => {
                capturedUrl = request.url;
                return HttpResponse.json(mockClearListDebug);
            })
        );

        renderWithTheme(<ClearListDebugButton courierId={99} />);
        await user.click(screen.getByRole('button'));
        await screen.findByText('Clear List Debug');

        expect(capturedUrl).toContain('courierId=99');
    });

    it('renders the courierId from the response', async () => {
        const user = setupUser();

        server.use(
            http.get('*/courier/ClearListDebug', () => {
                return HttpResponse.json({ ...mockClearListDebug, courierId: 77, courierCode: 'C077' });
            })
        );

        renderWithTheme(<ClearListDebugButton courierId={77} />);
        await user.click(screen.getByRole('button'));

        expect(await screen.findByText('C077')).toBeInTheDocument();
    });

    it('shows error alert on server error', async () => {
        const user = setupUser();

        server.use(
            http.get('*/courier/ClearListDebug', () => {
                return new HttpResponse('Internal Server Error', { status: 500 });
            })
        );

        renderWithTheme(<ClearListDebugButton courierId={42} />);
        await user.click(screen.getByRole('button'));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
        expect(screen.queryByText('Courier')).not.toBeInTheDocument();
    });

    it('returns 400 when courierId is missing from the default handler', async () => {
        const user = setupUser();

        server.use(
            http.get('*/courier/ClearListDebug', ({ request }) => {
                const url = new URL(request.url);
                if (!url.searchParams.get('courierId')) {
                    return new HttpResponse('Missing courierId parameter', { status: 400 });
                }
                return HttpResponse.json(mockClearListDebug);
            })
        );

        renderWithTheme(<ClearListDebugButton courierId={42} />);
        await user.click(screen.getByRole('button'));

        expect(await screen.findByText('Clear List Debug')).toBeInTheDocument();
    });
});
