/**
 * Characterization tests for JobFileUploadDialog.
 *
 * Written against the MUI implementation ahead of the Mantine conversion, so
 * they pin the behaviour the port has to preserve. Every query is by visible
 * text, role or label — no MUI class names — so they survive the swap.
 */

import React from 'react';
import {act, screen, waitFor, within, fireEvent} from '@testing-library/react';
import {JobFileUploadDialog} from './JobFileUploadDialog';
import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import type {JobFile, JobFileUploadDialogProps} from './types';
import {
    getAttachedFiles,
    getJobDeliveryPhotos,
    uploadJobFile,
    uploadJobDeliveryPhotoOrSignature,
    deleteJobFile,
    deleteJobDeliveryPhotoOrSignature,
    downloadFile,
} from '../../../services/jobDetailApi';

jest.mock('../../../services/jobDetailApi', () => ({
    getAttachedFiles: jest.fn(),
    getJobDeliveryPhotos: jest.fn(),
    uploadJobFile: jest.fn(),
    uploadJobDeliveryPhotoOrSignature: jest.fn(),
    deleteJobFile: jest.fn(),
    deleteJobDeliveryPhotoOrSignature: jest.fn(),
    downloadFile: jest.fn(),
}));

const mockGetAttachedFiles = getAttachedFiles as jest.Mock;
const mockGetJobDeliveryPhotos = getJobDeliveryPhotos as jest.Mock;
const mockUploadJobFile = uploadJobFile as jest.Mock;
const mockUploadPod = uploadJobDeliveryPhotoOrSignature as jest.Mock;
const mockDeleteJobFile = deleteJobFile as jest.Mock;
const mockDeletePod = deleteJobDeliveryPhotoOrSignature as jest.Mock;
const mockDownloadFile = downloadFile as jest.Mock;

const normalFile: JobFile = {
    fileName: 'invoice.pdf',
    s3Key: 'jobs/1/invoice.pdf',
    contentType: 'application/pdf',
    size: 2048,
    lastModified: '2026-03-04T09:30:00',
    isPOD: false,
};

const podFile: JobFile = {
    fileName: 'signature.jpg',
    s3Key: 'jobs/1/DeliveryPhotos/signature.jpg',
    contentType: 'image/jpeg',
    size: 1024,
    uploadDate: '2026-03-05T14:15:00',
    isPOD: true,
    podDescription: 'Left with reception',
};

function renderDialog(overrides: Partial<JobFileUploadDialogProps> = {}) {
    const props: JobFileUploadDialogProps = {
        open: true,
        jobId: 1,
        initialUploadType: 'normal',
        onClose: jest.fn(),
        showToast: jest.fn(),
        ...overrides,
    };
    return {props, ...renderWithMantine(<JobFileUploadDialog {...props} />)};
}

/**
 * The file input is deliberately hidden, so there is no accessible query for it —
 * and the dialog renders in a portal, so it is off the render container.
 */
function fileInput(): HTMLInputElement {
    const input = document.body.querySelector('input[type="file"]');
    if (!input) throw new Error('file input not found');
    return input as HTMLInputElement;
}

function makeFile(name: string, type: string, size: number): File {
    const file = new File(['x'], name, {type});
    Object.defineProperty(file, 'size', {value: size});
    return file;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockGetAttachedFiles.mockResolvedValue([]);
    mockGetJobDeliveryPhotos.mockResolvedValue([]);
    mockUploadJobFile.mockResolvedValue(undefined);
    mockUploadPod.mockResolvedValue(undefined);
    mockDeleteJobFile.mockResolvedValue(undefined);
    mockDeletePod.mockResolvedValue(undefined);
    mockDownloadFile.mockResolvedValue(undefined);
});

describe('JobFileUploadDialog — normal (attached files) mode', () => {
    it('shows the attached-files chrome, table columns and the loaded files', async () => {
        mockGetAttachedFiles.mockResolvedValue([normalFile]);
        renderDialog();

        expect(screen.getByText('Attached Files')).toBeInTheDocument();
        expect(screen.getByText('Manage attached files for this job')).toBeInTheDocument();
        expect(screen.getByText(/drag and drop files here or click to upload/i)).toBeInTheDocument();
        expect(screen.getByText(/accepted file types: images, pdf\. max size: 10mb/i)).toBeInTheDocument();

        expect(await screen.findByText('invoice.pdf')).toBeInTheDocument();
        expect(screen.getByText('2 KB')).toBeInTheDocument();
        expect(screen.getByText('Mar 4, 2026 09:30:00')).toBeInTheDocument();

        // Column headers — the normal table has no Description column.
        expect(screen.getByText('File Name')).toBeInTheDocument();
        expect(screen.getByText('Last Modified')).toBeInTheDocument();
        expect(screen.queryByText('Description')).not.toBeInTheDocument();

        // Normal mode loads attached files only; POD photos are not fetched.
        expect(mockGetAttachedFiles).toHaveBeenCalledWith(1);
        expect(mockGetJobDeliveryPhotos).not.toHaveBeenCalled();

        // Normal mode has a close button, not the POD "Skip" affordance.
        expect(screen.queryByRole('button', {name: /skip/i})).not.toBeInTheDocument();
    });

    it('shows the empty state when the job has no files', async () => {
        renderDialog();
        expect(await screen.findByText('No files uploaded yet')).toBeInTheDocument();
    });

    it('reports a load failure through the toast', async () => {
        mockGetAttachedFiles.mockRejectedValue(new Error('boom'));
        const {props} = renderDialog();

        await waitFor(() =>
            expect(props.showToast).toHaveBeenCalledWith('Failed to load files. Please try again.', 'error'));
    });

    it('closes from both the header close button and the Complete action', async () => {
        const user = setupUser();
        const {props} = renderDialog();

        await user.click(screen.getByRole('button', {name: /close/i}));
        await user.click(screen.getByRole('button', {name: /complete/i}));

        expect(props.onClose).toHaveBeenCalledTimes(2);
    });
});

describe('JobFileUploadDialog — POD-only mode', () => {
    it('shows the POD chrome, description field, POD columns and the Skip action', async () => {
        mockGetAttachedFiles.mockResolvedValue([podFile]);
        renderDialog({initialUploadType: 'pod'});

        expect(screen.getByText('POD Photos')).toBeInTheDocument();
        expect(screen.getByText('Upload proof of delivery photos')).toBeInTheDocument();
        expect(screen.getByLabelText(/pod photo description/i)).toBeInTheDocument();
        expect(screen.getByText(/drag and drop pod photo here or click to upload/i)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /skip/i})).toBeInTheDocument();

        expect(await screen.findByText('signature.jpg')).toBeInTheDocument();
        expect(screen.getByText('Left with reception')).toBeInTheDocument();
        expect(screen.getByText('Photo Name')).toBeInTheDocument();
        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByText('Upload Date')).toBeInTheDocument();

        // POD mode also pulls the delivery photos for the current month.
        await waitFor(() => expect(mockGetJobDeliveryPhotos).toHaveBeenCalled());
        expect(mockGetJobDeliveryPhotos.mock.calls[0][0]).toBe(1);
    });

    it('merges delivery photos that are not already in the attached list', async () => {
        mockGetJobDeliveryPhotos.mockResolvedValue([{
            fileName: 'pod-extra.jpg',
            s3Key: 'jobs/1/DeliveryPhotos/pod-extra.jpg',
            contentType: 'image/jpeg',
            size: 512,
            uploadDate: '2026-03-06T08:00:00',
            podDescription: 'Front door',
        }]);
        renderDialog({initialUploadType: 'pod'});

        expect(await screen.findByText('pod-extra.jpg')).toBeInTheDocument();
        expect(screen.getByText('Front door')).toBeInTheDocument();
    });

    it('closes via Skip', async () => {
        const user = setupUser();
        const {props} = renderDialog({initialUploadType: 'pod'});

        await user.click(screen.getByRole('button', {name: /skip/i}));
        expect(props.onClose).toHaveBeenCalled();
    });
});

describe('JobFileUploadDialog — both mode', () => {
    it('offers both tabs and swaps content when the POD tab is selected', async () => {
        const user = setupUser();
        renderDialog({initialUploadType: 'both'});

        expect(screen.getByText('File Upload')).toBeInTheDocument();
        expect(screen.getByText('Manage regular files and POD photos for this job')).toBeInTheDocument();

        const regularTab = screen.getByRole('tab', {name: /regular files/i});
        const podTab = screen.getByRole('tab', {name: /pod photos/i});
        expect(regularTab).toBeInTheDocument();
        expect(screen.getByText(/drag and drop files here or click to upload/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/pod photo description/i)).not.toBeInTheDocument();

        await user.click(podTab);

        expect(await screen.findByLabelText(/pod photo description/i)).toBeInTheDocument();
        expect(screen.getByText(/drag and drop pod photo here or click to upload/i)).toBeInTheDocument();
    });
});

describe('JobFileUploadDialog — uploading', () => {
    it('uploads a selected file, toasts success and refreshes the list', async () => {
        const {props} = renderDialog();
        await screen.findByText('No files uploaded yet');

        const file = makeFile('photo.png', 'image/png', 1000);
        fireEvent.change(fileInput(), {target: {files: [file]}});

        await waitFor(() => expect(mockUploadJobFile).toHaveBeenCalled());
        expect(mockUploadJobFile.mock.calls[0][0]).toBe(1);
        expect(mockUploadJobFile.mock.calls[0][1]).toBe(file);
        await waitFor(() =>
            expect(props.showToast).toHaveBeenCalledWith('Success photo.png uploaded as file', 'success'));
        // One load on open, one after the upload completes.
        expect(mockGetAttachedFiles).toHaveBeenCalledTimes(2);
    });

    it('uploads through the POD endpoint with the entered description', async () => {
        const user = setupUser();
        const {props} = renderDialog({initialUploadType: 'pod'});
        await screen.findByText('No files uploaded yet');

        await user.type(screen.getByLabelText(/pod photo description/i), 'Signed by Dana');

        const file = makeFile('pod.jpg', 'image/jpeg', 1000);
        fireEvent.change(fileInput(), {target: {files: [file]}});

        await waitFor(() => expect(mockUploadPod).toHaveBeenCalled());
        expect(mockUploadPod.mock.calls[0][2]).toBe('Signed by Dana');
        await waitFor(() =>
            expect(props.showToast).toHaveBeenCalledWith('Success pod.jpg uploaded as POD photo', 'success'));
    });

    it('rejects an unaccepted file type without calling the API', async () => {
        const {props} = renderDialog();
        await screen.findByText('No files uploaded yet');

        fireEvent.change(fileInput(), {
            target: {files: [makeFile('notes.txt', 'text/plain', 1000)]},
        });

        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith(
            'Invalid file type: notes.txt. Only images and PDFs are accepted.', 'error'));
        expect(mockUploadJobFile).not.toHaveBeenCalled();
    });

    it('rejects a file over the 10MB limit without calling the API', async () => {
        const {props} = renderDialog();
        await screen.findByText('No files uploaded yet');

        fireEvent.change(fileInput(), {
            target: {files: [makeFile('huge.png', 'image/png', 11 * 1024 * 1024)]},
        });

        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith(
            'Files exceed 10MB limit: huge.png', 'error'));
        expect(mockUploadJobFile).not.toHaveBeenCalled();
    });

    it('surfaces per-file progress and locks the dialog while an upload is in flight', async () => {
        let reportProgress: ((percent: number) => void) | undefined;
        mockUploadJobFile.mockImplementation((_jobId, _file, onProgress) => {
            reportProgress = onProgress;
            return new Promise(() => {/* never settles — holds the uploading state */});
        });

        renderDialog();
        await screen.findByText('No files uploaded yet');

        fireEvent.change(fileInput(), {
            target: {files: [makeFile('photo.png', 'image/png', 1000)]},
        });

        expect(await screen.findByText('Uploading Files (0/1)')).toBeInTheDocument();
        expect(screen.getByText('Overall Progress')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /complete/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /close/i})).toBeDisabled();

        // Progress is pushed from the upload call, outside React's event loop.
        act(() => reportProgress?.(40));
        // Reported once as the overall figure and once against the single file.
        await waitFor(() => expect(screen.getAllByText('40%')).toHaveLength(2));
        expect(screen.getByText('photo.png')).toBeInTheDocument();
    });

    it('reports an upload failure through the toast', async () => {
        mockUploadJobFile.mockRejectedValue(new Error('nope'));
        const {props} = renderDialog();
        await screen.findByText('No files uploaded yet');

        fireEvent.change(fileInput(), {
            target: {files: [makeFile('photo.png', 'image/png', 1000)]},
        });

        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith(
            'Failed to upload file: photo.png', 'error'));
    });
});

describe('JobFileUploadDialog — row actions', () => {
    it('downloads a file and toasts success', async () => {
        const user = setupUser();
        mockGetAttachedFiles.mockResolvedValue([normalFile]);
        const {props} = renderDialog();

        const row = (await screen.findByText('invoice.pdf')).closest('tr') as HTMLElement;
        await user.click(within(row).getByRole('button', {name: /download/i}));

        expect(mockDownloadFile).toHaveBeenCalledWith('jobs/1/invoice.pdf', 'invoice.pdf');
        await waitFor(() =>
            expect(props.showToast).toHaveBeenCalledWith('File downloaded successfully', 'success'));
    });

    it('deletes a regular file through the file endpoint', async () => {
        const user = setupUser();
        mockGetAttachedFiles.mockResolvedValue([normalFile]);
        const {props} = renderDialog();

        const row = (await screen.findByText('invoice.pdf')).closest('tr') as HTMLElement;
        await user.click(within(row).getByRole('button', {name: /delete/i}));

        expect(mockDeleteJobFile).toHaveBeenCalledWith(1, 'jobs/1/invoice.pdf');
        expect(mockDeletePod).not.toHaveBeenCalled();
        await waitFor(() =>
            expect(props.showToast).toHaveBeenCalledWith('File deleted successfully', 'success'));
    });

    it('deletes a POD photo through the delivery-photo endpoint', async () => {
        const user = setupUser();
        mockGetAttachedFiles.mockResolvedValue([podFile]);
        const {props} = renderDialog({initialUploadType: 'pod'});

        const row = (await screen.findByText('signature.jpg')).closest('tr') as HTMLElement;
        await user.click(within(row).getByRole('button', {name: /delete/i}));

        expect(mockDeletePod).toHaveBeenCalledWith(1, 'jobs/1/DeliveryPhotos/signature.jpg');
        expect(mockDeleteJobFile).not.toHaveBeenCalled();
        await waitFor(() =>
            expect(props.showToast).toHaveBeenCalledWith('POD photo deleted successfully', 'success'));
    });
});

describe('JobFileUploadDialog — closed', () => {
    it('renders no dialog and loads nothing while closed', () => {
        renderDialog({open: false});

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mockGetAttachedFiles).not.toHaveBeenCalled();
    });
});
