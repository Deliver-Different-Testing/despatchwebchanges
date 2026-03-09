/**
 * ComposeEmailDialog Tests
 *
 * Tests for the compose email dialog component including rendering,
 * form validation, template application, and send behaviour.
 */

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ComposeEmailDialog} from './ComposeEmailDialog';
import {renderWithTheme} from '../../../__testUtils__';
import {DriverEmail, GroupEmailData} from '../../../interfaces';

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
    renderWithTheme(<ComposeEmailDialog {...defaultProps} {...props} />);

describe('ComposeEmailDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

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
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('Subject'), 'Test Subject');
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.queryByText('Please enter an email subject')).not.toBeInTheDocument();
            expect(screen.getByText('Please enter an email message')).toBeInTheDocument();
        });

        it('should show subject error when only body is filled', async () => {
            renderDialog();
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('Message'), 'Test body content');
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.getByText('Please enter an email subject')).toBeInTheDocument();
            expect(screen.queryByText('Please enter an email message')).not.toBeInTheDocument();
        });

        it('should treat whitespace-only subject as empty', async () => {
            renderDialog();
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('Subject'), '   ');
            await user.type(screen.getByLabelText('Message'), 'Some body');
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.getByText('Please enter an email subject')).toBeInTheDocument();
            expect(defaultProps.onSend).not.toHaveBeenCalled();
        });

        it('should treat whitespace-only body as empty', async () => {
            renderDialog();
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('Subject'), 'Valid subject');
            await user.type(screen.getByLabelText('Message'), '   ');
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(screen.getByText('Please enter an email message')).toBeInTheDocument();
            expect(defaultProps.onSend).not.toHaveBeenCalled();
        });

        it('should clear subject error when user types in subject field', async () => {
            renderDialog();
            const user = userEvent.setup();

            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));
            expect(screen.getByText('Please enter an email subject')).toBeInTheDocument();

            await user.type(screen.getByLabelText('Subject'), 'T');

            expect(screen.queryByText('Please enter an email subject')).not.toBeInTheDocument();
        });

        it('should clear body error when user types in body field', async () => {
            renderDialog();
            const user = userEvent.setup();

            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));
            expect(screen.getByText('Please enter an email message')).toBeInTheDocument();

            await user.type(screen.getByLabelText('Message'), 'T');

            expect(screen.queryByText('Please enter an email message')).not.toBeInTheDocument();
        });
    });

    describe('Send', () => {
        it('should call onSend with correct data when form is valid', async () => {
            renderDialog();
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('Subject'), 'Test Subject');
            await user.type(screen.getByLabelText('Message'), 'Test body content');
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            expect(defaultProps.onSend).toHaveBeenCalledWith({
                courierIds: [1, 2, 3],
                subject: 'Test Subject',
                body: 'Test body content',
            });
        });

        it('should trim subject and body before sending', async () => {
            renderDialog();
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('Subject'), '  Padded Subject  ');
            await user.type(screen.getByLabelText('Message'), '  Padded body  ');
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
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('Subject'), 'Subject');
            await user.type(screen.getByLabelText('Message'), 'Body');
            fireEvent.click(screen.getByRole('button', {name: 'Send Email'}));

            const sentData = defaultProps.onSend.mock.calls[0][0] as GroupEmailData;
            expect(sentData.courierIds).toEqual([1, 2, 3]);
        });

        it('should reset form fields after successful send', async () => {
            renderDialog();
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('Subject'), 'Test Subject');
            await user.type(screen.getByLabelText('Message'), 'Test body');
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
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('Subject'), 'Direct');
            await user.type(screen.getByLabelText('Message'), 'Personal message');
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
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('Subject'), 'Draft subject');
            await user.type(screen.getByLabelText('Message'), 'Draft body');
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
});
