/**
 * Bulk Price API Service
 *
 * Handles API calls for bulk price upload operations.
 */

import { apiClient } from './apiClient';
import { BulkPricePreviewResponse, PricingMode } from '../components/dialogs/bulk-price-upload-dialog';

export class BulkPriceApiService {
    /**
     * Apply bulk price update from uploaded file.
     */
    async applyBulkPriceUpdate(
        file: File,
        pricingMode: PricingMode
    ): Promise<BulkPricePreviewResponse> {
        const formData = new FormData();
        formData.append('file', file);

        return apiClient.postFormData<BulkPricePreviewResponse>(
            '/job/ApplyBulkPriceUpdate',
            formData,
            { params: { pricingMode } }
        );
    }
}

export const bulkPriceApi = new BulkPriceApiService();
