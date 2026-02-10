/**
 * MSW Handler Index
 *
 * Barrel export combining all API handlers.
 */

import { messagingHandlers } from './messagingHandlers';
import { addressHandlers } from './addressHandlers';
import { jobHandlers } from './jobHandlers';
import { courierHandlers } from './courierHandlers';
import { taskHandlers } from './taskHandlers';
import { noteHandlers } from './noteHandlers';
import { eventHandlers } from './eventHandlers';
import { additionalServicesHandlers } from './additionalServicesHandlers';
import { pricingBreakdownHandlers } from './pricingBreakdownHandlers';
import { recurringJobsHandlers } from './recurringJobsHandlers';
import { splitJobHandlers } from './splitJobHandlers';
import { agentHandlers } from './agentHandlers';
import { nationwideHandlers } from './nationwideHandlers';
import { bulkPriceHandlers } from './bulkPriceHandlers';

export const handlers = [
    ...messagingHandlers,
    ...addressHandlers,
    ...jobHandlers,
    ...courierHandlers,
    ...taskHandlers,
    ...noteHandlers,
    ...eventHandlers,
    ...additionalServicesHandlers,
    ...pricingBreakdownHandlers,
    ...recurringJobsHandlers,
    ...splitJobHandlers,
    ...agentHandlers,
    ...nationwideHandlers,
    ...bulkPriceHandlers,
];

// Re-export individual handler arrays for selective use
export { messagingHandlers } from './messagingHandlers';
export { addressHandlers } from './addressHandlers';
export { jobHandlers } from './jobHandlers';
export { courierHandlers } from './courierHandlers';
export { taskHandlers } from './taskHandlers';
export { noteHandlers } from './noteHandlers';
export { eventHandlers } from './eventHandlers';
export { additionalServicesHandlers } from './additionalServicesHandlers';
export { pricingBreakdownHandlers } from './pricingBreakdownHandlers';
export { recurringJobsHandlers } from './recurringJobsHandlers';
export { splitJobHandlers } from './splitJobHandlers';
export { agentHandlers } from './agentHandlers';
export { nationwideHandlers } from './nationwideHandlers';
export { bulkPriceHandlers } from './bulkPriceHandlers';

// Re-export mock data for test assertions
export { mockRecentConversations, mockChatMessages, mockQuickResponses, mockContactOptions } from './messagingHandlers';
export { mockLocationResults, mockLookupResponse } from './addressHandlers';
export { mockRelatedJobs } from './jobHandlers';
export { mockCourierSuggestions, mockCourierLocations, mockClearListEnvelope, mockTimeZoneOptions } from './courierHandlers';
export { mockTaskApiResponses, mockStaffSuggestions, mockEventTypeSuggestions, mockDeliveryJourneyDtos } from './taskHandlers';
export { mockJobNoteDtos, mockNoteTypes } from './noteHandlers';
export { mockDispatchJobDetail } from './eventHandlers';
export { mockAdditionalServices } from './additionalServicesHandlers';
export { mockPriceBreakdowns } from './pricingBreakdownHandlers';
export { mockSpeedOptions, mockPaginatedRecurringJobsResponse } from './recurringJobsHandlers';
export { mockAgentInfo } from './agentHandlers';
export { mockFlightCargoProcessingDto, mockFlightViewModelDtos } from './nationwideHandlers';
export { mockBulkPricePreviewResponse } from './bulkPriceHandlers';
