/** @jest-environment node */
/**
 * JobDetails.types utility function tests
 */

import {getTrackingMethodText, isImageFile, isPdfFile} from './JobDetails.types';

describe('getTrackingMethodText', () => {
    it.each([
        [1, 'Email'],
        [2, 'Mobile'],
        [3, 'Email & Mobile'],
        [undefined, ''],
        [0, ''],
        [99, ''],
    ])('returns %p → %p', (input, expected) => {
        expect(getTrackingMethodText(input as any)).toBe(expected);
    });
});

describe('isImageFile', () => {
    it('returns true for image content types, extensions, and s3Key', () => {
        expect(isImageFile({contentType: 'image/jpeg'})).toBe(true);
        expect(isImageFile({contentType: 'image/png'})).toBe(true);
        expect(isImageFile({contentType: 'image/gif'})).toBe(true);
        expect(isImageFile({contentType: 'image/webp'})).toBe(true);
        expect(isImageFile({fileName: 'photo.jpg'})).toBe(true);
        expect(isImageFile({fileName: 'photo.JPEG'})).toBe(true);
        expect(isImageFile({fileName: 'photo.png'})).toBe(true);
        expect(isImageFile({fileName: 'photo.gif'})).toBe(true);
        expect(isImageFile({fileName: 'photo.webp'})).toBe(true);
        expect(isImageFile({fileName: 'photo.bmp'})).toBe(true);
        expect(isImageFile({s3Key: 'uploads/photo.jpg'})).toBe(true);
    });

    it('returns false for non-image files', () => {
        expect(isImageFile({contentType: 'application/pdf'})).toBe(false);
        expect(isImageFile({contentType: 'text/plain'})).toBe(false);
        expect(isImageFile({fileName: 'document.pdf'})).toBe(false);
        expect(isImageFile({fileName: 'data.csv'})).toBe(false);
    });

    it('returns false for null/undefined', () => {
        expect(isImageFile(null as any)).toBe(false);
        expect(isImageFile(undefined as any)).toBe(false);
    });
});

describe('isPdfFile', () => {
    it('returns true for PDF content type, extensions, and s3Key', () => {
        expect(isPdfFile({contentType: 'application/pdf'})).toBe(true);
        expect(isPdfFile({fileName: 'document.pdf'})).toBe(true);
        expect(isPdfFile({fileName: 'DOCUMENT.PDF'})).toBe(true);
        expect(isPdfFile({s3Key: 'uploads/document.pdf'})).toBe(true);
    });

    it('returns false for non-PDF files', () => {
        expect(isPdfFile({contentType: 'image/jpeg'})).toBe(false);
        expect(isPdfFile({fileName: 'photo.jpg'})).toBe(false);
    });

    it('returns false for null/undefined', () => {
        expect(isPdfFile(null as any)).toBe(false);
        expect(isPdfFile(undefined as any)).toBe(false);
    });
});
