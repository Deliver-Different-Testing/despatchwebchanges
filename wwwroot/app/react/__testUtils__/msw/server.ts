/**
 * MSW Server Setup
 *
 * Mock Service Worker server for integration tests.
 * Intercepts HTTP requests made by axios/apiClient.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers/index';

export const server = setupServer(...handlers);
