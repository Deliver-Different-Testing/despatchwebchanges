/**
 * File Upload API Handlers
 *
 * MSW handlers for job file upload/download/delete endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { JobFile } from '../../../components/dialogs/job-file-upload-dialog/types';

export const mockAttachedFiles: JobFile[] = [
    {
        fileName: 'invoice_2026.pdf',
        s3Key: 'jobs/123/invoice_2026.pdf',
        contentType: 'application/pdf',
        size: 245_760,
        lastModified: '2026-03-25T14:30:00',
        isPOD: false,
    },
    {
        fileName: 'delivery_photo.jpg',
        s3Key: 'jobs/123/DeliveryPhotos/delivery_photo.jpg',
        contentType: 'image/jpeg',
        size: 2_097_152,
        uploadDate: '2026-03-26T10:00:00',
        isPOD: true,
        podDescription: 'Left at front door',
    },
];

export const mockDeliveryPhotos = [
    {
        s3Key: 'pods/123/front_door.jpg',
        fileName: 'front_door.jpg',
        contentType: 'image/jpeg',
        size: 1_048_576,
        uploadDate: '2026-03-26T09:00:00',
        podDescription: 'Front door delivery',
    },
];

export const fileUploadHandlers = [
    // Get attached files
    http.get('*/job/getAttachedFiles', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        return HttpResponse.json(mockAttachedFiles);
    }),

    // Get delivery photos and signatures
    http.get('*/Job/GetJobDeliveryPhotosAndSignature', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        return HttpResponse.json(mockDeliveryPhotos);
    }),

    // Upload regular file
    http.post('*/job/uploadFile', async ({ request }) => {
        const formData = await request.formData();
        const jobId = formData.get('jobId');
        const file = formData.get('file') as File | null;

        if (!jobId || !file) {
            return HttpResponse.json('Missing required fields', { status: 400 });
        }

        return HttpResponse.json({
            message: 'File uploaded successfully',
            fileName: file.name,
            s3Key: `jobs/${jobId}/${file.name}`,
            size: file.size,
            contentType: file.type,
            uploadDate: '2026-03-27T12:00:00Z',
        });
    }),

    // Upload POD photo or signature
    http.post('*/job/uploadJobDeliveryPhotoOrSignature', async ({ request }) => {
        const formData = await request.formData();
        const jobId = formData.get('jobId');
        const file = formData.get('file') as File | null;
        const podDescription = formData.get('podDescription') as string | null;

        if (!jobId || !file) {
            return HttpResponse.json('Missing required fields', { status: 400 });
        }

        return HttpResponse.json({
            success: true,
            fileName: file.name,
            s3Key: `pods/${jobId}/${file.name}`,
            contentType: file.type,
            size: file.size,
            uploadDate: '2026-03-27T12:00:00Z',
            isPOD: true,
            podDescription: podDescription ?? '',
        });
    }),

    // Delete regular file
    http.delete('*/job/DeleteFile', ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get('key');

        if (!key) {
            return HttpResponse.json('Failed to delete file or file key is required', { status: 400 });
        }

        return HttpResponse.json({ message: 'File deleted successfully' });
    }),

    // Delete POD photo or signature
    http.delete('*/job/DeleteJobDeliveryPhotoOrSignature', ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get('key');
        const jobId = url.searchParams.get('jobId');

        if (!key || !jobId) {
            return HttpResponse.json('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json({ success: true, message: 'File deleted successfully' });
    }),

    // Download file
    http.post('*/job/DownloadFile', ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get('key');

        if (!key) {
            return HttpResponse.json('Missing key parameter', { status: 400 });
        }

        // Return a small PNG blob
        const pngBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));

        return new HttpResponse(pngBytes, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="placeholder.png"`,
            },
        });
    }),
];
