/**
 * MSW Handler Index
 *
 * Barrel export combining all API handlers.
 */

import { messagingHandlers } from './messagingHandlers';
import { addressHandlers } from './addressHandlers';
import { jobHandlers } from './jobHandlers';
import { courierHandlers } from './courierHandlers';

export const handlers = [
    ...messagingHandlers,
    ...addressHandlers,
    ...jobHandlers,
    ...courierHandlers,
];

// Re-export individual handler arrays for selective use
export { messagingHandlers } from './messagingHandlers';
export { addressHandlers } from './addressHandlers';
export { jobHandlers } from './jobHandlers';
export { courierHandlers } from './courierHandlers';

// Re-export mock data for test assertions
export { mockRecentConversations, mockChatMessages, mockQuickResponses, mockContactOptions } from './messagingHandlers';
export { mockLocationResults, mockLookupResponse } from './addressHandlers';
export { mockRelatedJobs } from './jobHandlers';
export { mockCourierSuggestions, mockCourierLocations, mockClearListEnvelope } from './courierHandlers';
