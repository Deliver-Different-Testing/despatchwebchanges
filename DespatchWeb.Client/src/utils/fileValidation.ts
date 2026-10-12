/**
 * Client-side validation for file-download params. Defense-in-depth only — the
 * backend MUST repeat these checks. Used by both the React jobDetailApi and the
 * legacy AngularJS dispatch-core.service.
 *
 * - S3 keys: forbid `..` (path traversal) and `\0` (null-byte injection). Slashes
 *   are allowed because S3 keys are slash-delimited.
 * - File names: forbid `..`, `\0`, and any path separator since the value lands
 *   in a Content-Disposition header.
 */

export function assertValidS3Key(s3Key: string): void {
    if (!s3Key || s3Key.includes('..') || s3Key.includes('\0')) {
        throw new Error('Invalid file key');
    }
}

export function assertValidDownloadFileName(fileName: string): void {
    if (!fileName
        || fileName.includes('..')
        || fileName.includes('\0')
        || fileName.includes('/')
        || fileName.includes('\\')) {
        throw new Error('Invalid file name');
    }
}
