/**
 * ComposeEmailDialog Tests
 *
 * Tests for the compose email dialog component including rendering,
 * form validation, template application, and send behaviour.
 */

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {ComposeEmailDialog} from './ComposeEmailDialog';
import { renderWithMantine } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
import {DriverEmail, GroupEmailData} from '../../../interfaces';
import {draftEmail} from '../../../services/aiAssistantApi';
import {disableAutoMate, enableAutoMate, resetAiPreferences} from '../../../__testUtils__/aiPreferences';

jest.mock('../../../services/aiAssistantApi', () => ({draftEmail: jest.fn()}));

const mockDraftEmail = draftEmail as jest.Mock;

const createMockCouriers = (): DriverEmail[] => [
    {courierId: 1, code: 'C01', name: 'Alice Smith', email: 'alice@test.com', phone: '111', fleet: 'Alpha'},
    {courierId: 2, code: 'C02', name: 'Bob Jones', email: 'bob@test.com', phone: '222', fleet: 'Beta'},
    {courierId: 3, code: 'C03', name: 'Charlie Brown', email: 'charlie@test.com', phone: '333', fleet: 'Alpha'},
];

const defaultProps = {
    open: true,
    selectedCouriers: createMockCouriers(),
    onClose: jest.fn(),
    onSend: jest.fn(),
};

const renderDialog = (props: Partial<typeof defaultProps> = {}) =>
    renderWithMantine(<ComposeEmailDialog {...defaultProps} {...props} />);

describe('ComposeEmailDialog', () => {
    describe('Rendering', () => {
        it('should render the dialog when open', () => {
            renderDialog();

            expect(screen.getByText('Compose Email')).toBeInTheDocument();
        });

        it('should not render dialog content when closed', () => {
            renderDialog({open: false});

            expect(screen.queryByText('Compose Email')).not.toBeInTheDocument();
        });

        it('should display recipient count', () => {
            renderDialog();

            expect(screen.getByText('Recipients (3)')).toBeInTheDocument();
        });

        it('should display all recipient names as chips', () => {
            renderDialog();

            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
            expect(screen.getByText('Bob Jones')).toBeInTheDocument();
            expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
        });

        it('should display correct count for single recipient', () => {
            renderDialog({selectedCouriers: [createMockCouriers()[0]]});

            expect(screen.getByText('Recipients (1)')).toBeInTheDocument();
        });

        it('should render subject and message fields', () => {
            renderDialog();

            expect(screen.getByLabelText('Subject')).toBeInTheDocument();
            expect(screen.getByLabelText('Message')).toBeInTheDocument();
        });

        it('should render Send Email and Cancel buttons', () => {
            renderDialog();

            expect(screen.getByRole('button', {name: 'Send Email'})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
        });

        it('should render all template buttons', () => {
            renderDialog();

            expect(screen.getByRole('button', {name: 'Weekly Update'})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Urgent Notice'})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Schedule Change'})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Announcement'})).toBeInTheDocument();
        });
    });

    describe('Templates', () => {
        it('should populate subject and body when Weekly Update template is clicked', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Weekly Update'}));

            expect(screen.getByLabelText('Subject')).toHaveValue('Weekly Team Update');
            expect(screen.getByLabelText<HTMLTextAreaElement>('Message').value).toContain('weekly update');
        });

        it('should populate subject and body when Urgent Notice template is clicked', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Urgent Notice'}));

            expect(screen.getByLabelText('Subject')).toHaveValue('URGENT: Important Notice');
            expect(screen.getByLabelText<HTMLTextAreaElement>('Message').value).toContain('URGENT NOTICE');
        });

        it('should populate subject and body when Schedule Change template is clicked', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Schedule Change'}));

            expect(screen.getByLabelText('Subject')).toHaveValue('Schedule Change Notification');
            expect(screen.getByLabelText<HTMLTextAreaElement>('Message').value).toContain('schedule changes');
        });

        it('should populate subject and body when Announcement template is clicked', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Announcement'}));

            expect(screen.getByLabelText('Subject')).toHaveValue('Team Announcement');
            expect(screen.getByLabelText<HTMLTextAreaElement>('Message').value).toContain('announcement');
        });

        it('should override previous template when a different one is selected', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Weekly Update'}));
            expect(screen.getByLabelText('Subject')).toHaveValue('Weekly Team Update');

            fireEvent.click(screen.getByRole('button', {name: 'Urgent Notice'}));
            expect(screen.getByLabelText('Subject')).toHaveValue('URGENT: Important Notice');
        });

        it('should clear validation errors when a template is applied', async () => {
            renderDialog();

            // Trigger validation errors
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));
            expect(screen.getByText('Please enter an email subject')).toBeInTheDocument();

            // Apply template should clear errors
            fireEvent.click(screen.getByRole('button', {name: 'Weekly Update'}));

            expect(screen.queryByText('Please enter an email subject')).not.toBeInTheDocument();
            expect(screen.queryByText('Please enter an email message')).not.toBeInTheDocument();
        });
    });

    describe('Validation', () => {
        it('should show subject error when sending with empty subject', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.getByText('Please enter an email subject')).toBeInTheDocument();
        });

        it('should show body error when sending with empty body', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.getByText('Please enter an email message')).toBeInTheDocument();
        });

        it('should show both errors when both fields are empty', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.getByText('Please enter an email subject')).toBeInTheDocument();
            expect(screen.getByText('Please enter an email message')).toBeInTheDocument();
        });

        it('should not call onSend when validation fails', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(defaultProps.onSend).not.toHaveBeenCalled();
        });

        it('should show body error when only subject is filled', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.change(screen.getByLabelText('Subject'), {target: {value: 'Test Subject'}});
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.queryByText('Please enter an email subject')).not.toBeInTheDocument();
            expect(screen.getByText('Please enter an email message')).toBeInTheDocument();
        });

        it('should show subject error when only body is filled', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.change(screen.getByLabelText('Message'), {target: {value: 'Test body content'}});
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.getByText('Please enter an email subject')).toBeInTheDocument();
            expect(screen.queryByText('Please enter an email message')).not.toBeInTheDocument();
        });

        it('should treat whitespace-only subject as empty', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.change(screen.getByLabelText('Subject'), {target: {value: '   '}});
            fireEvent.change(screen.getByLabelText('Message'), {target: {value: 'Some body'}});
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.getByText('Please enter an email subject')).toBeInTheDocument();
            expect(defaultProps.onSend).not.toHaveBeenCalled();
        });

        it('should treat whitespace-only body as empty', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.change(screen.getByLabelText('Subject'), {target: {value: 'Valid subject'}});
            fireEvent.change(screen.getByLabelText('Message'), {target: {value: '   '}});
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.getByText('Please enter an email message')).toBeInTheDocument();
            expect(defaultProps.onSend).not.toHaveBeenCalled();
        });

        it('should clear subject error when user types in subject field', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));
            expect(screen.getByText('Please enter an email subject')).toBeInTheDocument();

            fireEvent.change(screen.getByLabelText('Subject'), {target: {value: 'T'}});

            expect(screen.queryByText('Please enter an email subject')).not.toBeInTheDocument();
        });

        it('should clear body error when user types in body field', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));
            expect(screen.getByText('Please enter an email message')).toBeInTheDocument();

            fireEvent.change(screen.getByLabelText('Message'), {target: {value: 'T'}});

            expect(screen.queryByText('Please enter an email message')).not.toBeInTheDocument();
        });
    });

    describe('Send', () => {
        it('should call onSend with correct data when form is valid', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.change(screen.getByLabelText('Subject'), {target: {value: 'Test Subject'}});
            fireEvent.change(screen.getByLabelText('Message'), {target: {value: 'Test body content'}});
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(defaultProps.onSend).toHaveBeenCalledWith({
                courierIds: [1, 2, 3],
                subject: 'Test Subject',
                body: 'Test body content',
            });
        });

        it('should trim subject and body before sending', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.change(screen.getByLabelText('Subject'), {target: {value: '  Padded Subject  '}});
            fireEvent.change(screen.getByLabelText('Message'), {target: {value: '  Padded body  '}});
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(defaultProps.onSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Padded Subject',
                    body: 'Padded body',
                })
            );
        });

        it('should include all selected courier IDs', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.change(screen.getByLabelText('Subject'), {target: {value: 'Subject'}});
            fireEvent.change(screen.getByLabelText('Message'), {target: {value: 'Body'}});
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            const sentData = defaultProps.onSend.mock.calls[0][0] as GroupEmailData;
            expect(sentData.courierIds).toEqual([1, 2, 3]);
        });

        it('should reset form fields after successful send', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.change(screen.getByLabelText('Subject'), {target: {value: 'Test Subject'}});
            fireEvent.change(screen.getByLabelText('Message'), {target: {value: 'Test body'}});
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.getByLabelText('Subject')).toHaveValue('');
            expect(screen.getByLabelText('Message')).toHaveValue('');
        });

        it('should send with template content', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Urgent Notice'}));
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(defaultProps.onSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'URGENT: Important Notice',
                    courierIds: [1, 2, 3],
                })
            );
        });

        it('should handle single courier', async () => {
            const singleCourier = [createMockCouriers()[0]];
            renderDialog({selectedCouriers: singleCourier});
            const user = setupUser();

            fireEvent.change(screen.getByLabelText('Subject'), {target: {value: 'Direct'}});
            fireEvent.change(screen.getByLabelText('Message'), {target: {value: 'Personal message'}});
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(defaultProps.onSend).toHaveBeenCalledWith({
                courierIds: [1],
                subject: 'Direct',
                body: 'Personal message',
            });
        });
    });

    describe('Close / Cancel', () => {
        it('should call onClose when Cancel is clicked', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });

        it('should reset form fields when cancelled', async () => {
            renderDialog();
            const user = setupUser();

            fireEvent.change(screen.getByLabelText('Subject'), {target: {value: 'Draft subject'}});
            fireEvent.change(screen.getByLabelText('Message'), {target: {value: 'Draft body'}});
            fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

            expect(screen.getByLabelText('Subject')).toHaveValue('');
            expect(screen.getByLabelText('Message')).toHaveValue('');
        });

        it('should clear validation errors when cancelled', () => {
            renderDialog();

            // Trigger errors then cancel
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));
            expect(screen.getByText('Please enter an email subject')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

            expect(screen.queryByText('Please enter an email subject')).not.toBeInTheDocument();
            expect(screen.queryByText('Please enter an email message')).not.toBeInTheDocument();
        });

        it('should not call onSend when cancelled', () => {
            renderDialog();

            fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

            expect(defaultProps.onSend).not.toHaveBeenCalled();
        });
    });

    describe('AI draft', () => {
        beforeEach(() => jest.clearAllMocks());

        it('hides the Draft button when AI is disabled', () => {
        disableAutoMate();

            renderDialog();

            expect(screen.queryByRole('button', {name: /^draft$/i})).not.toBeInTheDocument();
        });

        it('fills subject and body from the AI draft', async () => {
        enableAutoMate();
            mockDraftEmail.mockResolvedValueOnce({
                subject: 'Drafted subject',
                body: 'Drafted body',
                usage: {inputTokens: 1, outputTokens: 1},
            });
            renderDialog();
            const user = setupUser();

            await user.click(screen.getByRole('button', {name: /^draft$/i}));

            expect(await screen.findByDisplayValue('Drafted subject')).toBeInTheDocument();
            expect(await screen.findByDisplayValue('Drafted body')).toBeInTheDocument();
            expect(mockDraftEmail).toHaveBeenCalledWith(
                expect.objectContaining({recipientNames: ['Alice Smith', 'Bob Jones', 'Charlie Brown']}),
                expect.anything(),
            );
        });
    });
});
