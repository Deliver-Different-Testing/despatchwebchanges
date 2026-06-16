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
import { accessorialChargesHandlers } from './accessorialChargesHandlers';
import { pricingBreakdownHandlers } from './pricingBreakdownHandlers';
import { recurringJobsHandlers } from './recurringJobsHandlers';
import { splitJobHandlers } from './splitJobHandlers';
import { agentHandlers } from './agentHandlers';
import { nationwideHandlers } from './nationwideHandlers';
import { bulkPriceHandlers } from './bulkPriceHandlers';
import { driverManagementHandlers } from './driverManagementHandlers';
import { overviewHandlers } from './overviewHandlers';
import { jobSearchHandlers } from './jobSearchHandlers';
import { fileUploadHandlers } from './fileUploadHandlers';

export const handlers = [
    ...messagingHandlers,
    ...addressHandlers,
    ...jobHandlers,
    ...courierHandlers,
    ...taskHandlers,
    ...noteHandlers,
    ...eventHandlers,
    ...accessorialChargesHandlers,
    ...pricingBreakdownHandlers,
    ...recurringJobsHandlers,
    ...splitJobHandlers,
    ...agentHandlers,
    ...nationwideHandlers,
    ...bulkPriceHandlers,
    ...driverManagementHandlers,
    ...overviewHandlers,
    ...jobSearchHandlers,
    ...fileUploadHandlers,
];

// Re-export individual handler arrays for selective use
export { messagingHandlers } from './messagingHandlers';
export { addressHandlers } from './addressHandlers';
export { jobHandlers } from './jobHandlers';
export { courierHandlers } from './courierHandlers';
export { taskHandlers } from './taskHandlers';
export { noteHandlers } from './noteHandlers';
export { eventHandlers } from './eventHandlers';
export { accessorialChargesHandlers } from './accessorialChargesHandlers';
export { pricingBreakdownHandlers } from './pricingBreakdownHandlers';
export { recurringJobsHandlers } from './recurringJobsHandlers';
export { splitJobHandlers } from './splitJobHandlers';
export { agentHandlers } from './agentHandlers';
export { nationwideHandlers } from './nationwideHandlers';
export { bulkPriceHandlers } from './bulkPriceHandlers';
export { driverManagementHandlers } from './driverManagementHandlers';
export { overviewHandlers } from './overviewHandlers';
export { jobSearchHandlers } from './jobSearchHandlers';
export { fileUploadHandlers } from './fileUploadHandlers';

// Re-export mock data for test assertions
export { mockRecentConversations, mockChatMessages, mockQuickResponses, mockContactOptions } from './messagingHandlers';
export { mockLocationResults, mockLookupResponse } from './addressHandlers';
export { mockRelatedJobs, mockClientSuggestions, mockVehicleSizes } from './jobHandlers';
export { mockCourierSuggestions, mockCourierLocations, mockClearListEnvelope, mockClearListDebug, mockTimeZoneOptions } from './courierHandlers';
export { mockTaskApiResponses, mockStaffSuggestions, mockEventTypeSuggestions, mockDeliveryJourneyDtos } from './taskHandlers';
export { mockJobNoteDtos, mockNoteTypes } from './noteHandlers';
export { mockDispatchJobDetail } from './eventHandlers';
export { mockAvailableCharges, mockAppliedCharges, mockJobAmount } from './accessorialChargesHandlers';
export { mockPriceBreakdowns } from './pricingBreakdownHandlers';
export { mockSpeedOptions, mockPaginatedRecurringJobsResponse } from './recurringJobsHandlers';
export { mockAgentInfo } from './agentHandlers';
export { mockFlightCargoProcessingDto, mockFlightViewModelDtos } from './nationwideHandlers';
export { mockBulkPricePreviewResponse } from './bulkPriceHandlers';
export { mockFleetOptions, mockCourierSearchResults, mockCourierDetails, mockTodayActiveDrivers, mockComplianceList, mockAfterHoursSchedule, mockDriverEmails, mockDriverEarnings } from './driverManagementHandlers';
export { mockOverviewStats, mockOverviewRegions, mockOverviewSpeeds, mockOverviewJobsResponse, mockOverviewParentJobs, mockOpenJobDtos, mockMapConfig } from './overviewHandlers';
export { mockDispatchJobDto, mockJobSearchResultDto, mockEmptySearchResult } from './jobSearchHandlers';
export { mockAttachedFiles, mockDeliveryPhotos } from './fileUploadHandlers';
