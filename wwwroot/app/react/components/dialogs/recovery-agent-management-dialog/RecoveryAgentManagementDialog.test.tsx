/**
 * RecoveryAgentManagementDialog Component Tests
 */

import React from 'react';
import {act, screen, waitFor} from '@testing-library/react';
import {RecoveryAgentManagementDialog, RecoveryAgentManagementDialogProps} from './RecoveryAgentManagementDialog';
import { renderWithMantine } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
import type {Suggestion} from '../../../interfaces/job';
import type {RecoveryAgentJobViewModel} from '../../../interfaces/nationwideJobs';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

const mockAirports: Suggestion[] = [
    {id: 1, text: 'Los Angeles International (LAX)'},
    {id: 2, text: 'John F. Kennedy (JFK)'},
];

const mockAgents: Suggestion[] = [
    {id: 10, text: 'Acme Couriers'},
    {id: 11, text: 'Reliable Recovery'},
];

const mockJob: RecoveryAgentJobViewModel = {
    jobId: 123,
    jobNumber: 'JOB-123',
    assignedAgent: {id: 1, text: 'Main Agent'},
    pickUpAddress: {fullAddress: '123 Pickup St'},
    deliveryAddress: {fullAddress: '456 Delivery Ave'},
    packageType: 'Documents',
    priority: 'Urgent',
    lastKnownLocation: 'LAX Terminal',
    customer: 'Acme Corp',
    recoveryJobs: [
        {
            jobId: 200,
            assignedAgent: {id: 2, text: 'Recovery Job 1'},
            recoveryAgents: [
                {
                    recoveryId: 50,
                    agentName: 'Joe Recovery',
                    airport: 'LAX',
                    primaryRecoveryAgent: true,
                    assignStatus: 'searching',
                },
                {
                    recoveryId: 51,
                    agentName: 'Sue Recovery',
                    airport: 'JFK',
                    primaryRecoveryAgent: false,
                    assignStatus: 'assigned',
                },
            ],
        },
    ],
};

const emptyJob: RecoveryAgentJobViewModel = {
    ...mockJob,
    recoveryJobs: [],
};

const createMockProps = (
    overrides: Partial<RecoveryAgentManagementDialogProps> = {}
): RecoveryAgentManagementDialogProps => ({
    open: true,
    job: mockJob,
    onClose: jest.fn(),
    onLoadAirports: jest.fn().mockResolvedValue(mockAirports),
    onLoadAgentsForAirport: jest.fn().mockResolvedValue(mockAgents),
    onAddAgent: jest.fn().mockResolvedValue(undefined),
    onUpdateAgent: jest.fn().mockResolvedValue(undefined),
    onRemoveAgent: jest.fn().mockResolvedValue(undefined),
    onRefresh: jest.fn().mockResolvedValue(mockJob),
    showToast: jest.fn(),
    ...overrides,
});

describe('RecoveryAgentManagementDialog', () => {
    it('does not render dialog when open is false', () => {
        const props = createMockProps({open: false});
        renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders job header, package details, and existing recovery agents', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
        });

        await waitFor(() => {
            expect(props.onLoadAirports).toHaveBeenCalled();
        });

        expect(screen.getByText('Lost Package Recovery')).toBeInTheDocument();
        expect(screen.getByText('Job #JOB-123')).toBeInTheDocument();
        expect(screen.getByText('123 Pickup St')).toBeInTheDocument();
        expect(screen.getByText('456 Delivery Ave')).toBeInTheDocument();
        expect(screen.getByText('Documents')).toBeInTheDocument();
        expect(screen.getByText('Urgent')).toBeInTheDocument();
        expect(screen.getByText('LAX Terminal')).toBeInTheDocument();
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();

        // Main and recovery agents listed
        expect(screen.getByText('Main Agent')).toBeInTheDocument();
        expect(screen.getByText('Primary Job Agent')).toBeInTheDocument();
        expect(screen.getByText('Joe Recovery')).toBeInTheDocument();
        expect(screen.getByText('Sue Recovery')).toBeInTheDocument();
        expect(screen.getByText('Primary Recovery Agent')).toBeInTheDocument();
    });

    it('shows empty state when there are no recovery agents', async () => {
        const props = createMockProps({job: emptyJob});
        await act(async () => {
            renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
        });

        expect(screen.getByText('No Recovery Agents Assigned')).toBeInTheDocument();
        expect(
            screen.getByRole('button', {name: /assign first recovery agent/i})
        ).toBeInTheDocument();
    });

    it('shows a loading indicator until the job is provided', () => {
        const props = createMockProps({job: null});
        renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('loads agent options for the chosen airport and assigns an agent', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
        });

        await waitFor(() => {
            expect(props.onLoadAirports).toHaveBeenCalled();
        });

        // Open assign form
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: /assign agent/i}));
        });

        // Pick airport
        const airportSelect = screen.getByLabelText('Airport Location');
        await act(async () => {
            await userEvent.click(airportSelect);
        });
        await act(async () => {
            await userEvent.click(await screen.findByText('Los Angeles International (LAX)'));
        });

        await waitFor(() => {
            expect(props.onLoadAgentsForAirport).toHaveBeenCalledWith(1);
        });

        // Pick agent
        const agentSelect = screen.getByLabelText('Available Agent');
        await act(async () => {
            await userEvent.click(agentSelect);
        });
        await act(async () => {
            await userEvent.click(await screen.findByText('Acme Couriers'));
        });

        // Confirm assign
        const assignButton = screen.getAllByRole('button', {name: /assign agent/i}).pop()!;
        await act(async () => {
            await userEvent.click(assignButton);
        });

        await waitFor(() => {
            expect(props.onAddAgent).toHaveBeenCalledWith({
                jobId: 123,
                agentId: 10,
                airportId: 1,
                isPrimaryRecoveryAgent: false,
            });
            expect(props.onRefresh).toHaveBeenCalled();
            expect(props.showToast).toHaveBeenCalledWith(
                expect.stringContaining('Acme Couriers'),
                'success'
            );
        });
    });

    it('shows a warning when promoting a new agent to primary while another primary exists', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
        });
        await waitFor(() => {
            expect(props.onLoadAirports).toHaveBeenCalled();
        });

        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: /assign agent/i}));
        });

        const primaryCheckbox = screen.getByRole('checkbox', {name: /set as primary recovery agent/i});
        await act(async () => {
            await userEvent.click(primaryCheckbox);
        });

        expect(
            screen.getByText(
                /Setting this agent as primary will remove the current primary status from other agents\./
            )
        ).toBeInTheDocument();
    });

    it('opens the edit form and saves a primary toggle change', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
        });

        // Click edit on Sue (the non-primary agent)
        const editButton = screen.getByRole('button', {name: /edit sue recovery/i});
        await act(async () => {
            await userEvent.click(editButton);
        });

        expect(screen.getByText(/Edit Recovery Agent — Sue Recovery/)).toBeInTheDocument();

        const primaryCheckbox = screen.getByRole('checkbox', {name: /set as primary recovery agent/i});
        await act(async () => {
            await userEvent.click(primaryCheckbox);
        });

        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: /save changes/i}));
        });

        await waitFor(() => {
            expect(props.onUpdateAgent).toHaveBeenCalledWith({
                recoveryId: 51,
                isPrimaryRecoveryAgent: true,
            });
            expect(props.showToast).toHaveBeenCalledWith(
                expect.stringContaining('Sue Recovery'),
                'success'
            );
        });
    });

    it('removes an agent after confirmation', async () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
        try {
            const props = createMockProps();
            await act(async () => {
                renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
            });

            const removeButton = screen.getByRole('button', {name: /remove sue recovery/i});
            await act(async () => {
                await userEvent.click(removeButton);
            });

            await waitFor(() => {
                expect(confirmSpy).toHaveBeenCalled();
                expect(props.onRemoveAgent).toHaveBeenCalledWith(51);
                expect(props.onRefresh).toHaveBeenCalled();
                expect(props.showToast).toHaveBeenCalledWith(
                    expect.stringContaining('Sue Recovery'),
                    'success'
                );
            });
        } finally {
            confirmSpy.mockRestore();
        }
    });

    it('skips removal when the user cancels the confirmation', async () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
        try {
            const props = createMockProps();
            await act(async () => {
                renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
            });

            const removeButton = screen.getByRole('button', {name: /remove sue recovery/i});
            await act(async () => {
                await userEvent.click(removeButton);
            });

            expect(props.onRemoveAgent).not.toHaveBeenCalled();
        } finally {
            confirmSpy.mockRestore();
        }
    });

    it('surfaces a toast when assign fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const props = createMockProps({
                onAddAgent: jest.fn().mockRejectedValue(new Error('network')),
            });
            await act(async () => {
                renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadAirports).toHaveBeenCalled();
            });

            await act(async () => {
                await userEvent.click(screen.getByRole('button', {name: /assign agent/i}));
            });

            await act(async () => {
                await userEvent.click(screen.getByLabelText('Airport Location'));
            });
            await act(async () => {
                await userEvent.click(await screen.findByText('Los Angeles International (LAX)'));
            });
            await waitFor(() => {
                expect(props.onLoadAgentsForAirport).toHaveBeenCalledWith(1);
            });
            await act(async () => {
                await userEvent.click(screen.getByLabelText('Available Agent'));
            });
            await act(async () => {
                await userEvent.click(await screen.findByText('Acme Couriers'));
            });

            const assignButton = screen.getAllByRole('button', {name: /assign agent/i}).pop()!;
            await act(async () => {
                await userEvent.click(assignButton);
            });

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith(
                    'Failed to assign agent. Please try again.',
                    'error'
                );
            });
        } finally {
            consoleSpy.mockRestore();
        }
    });

    it('calls onClose when no forms are open and Cancel is clicked', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
        });

        await waitFor(() => {
            expect(props.onLoadAirports).toHaveBeenCalled();
        });

        // Use the footer Cancel button (last one)
        const cancelButtons = screen.getAllByRole('button', {name: /^cancel$/i});
        await act(async () => {
            await userEvent.click(cancelButtons[cancelButtons.length - 1]);
        });

        expect(props.onClose).toHaveBeenCalled();
    });

    it('warns about unsaved changes before closing while assign form is dirty', async () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
        try {
            const props = createMockProps();
            await act(async () => {
                renderWithMantine(<RecoveryAgentManagementDialog {...props} />);
            });
            await waitFor(() => {
                expect(props.onLoadAirports).toHaveBeenCalled();
            });

            await act(async () => {
                await userEvent.click(screen.getByRole('button', {name: /assign agent/i}));
            });

            const primaryCheckbox = screen.getByRole('checkbox', {name: /set as primary recovery agent/i});
            await act(async () => {
                await userEvent.click(primaryCheckbox);
            });

            // The header (X) closes the whole dialog, so it must run the unsaved-changes
            // guard — unlike the assign form's own Cancel, which just resets the form.
            await act(async () => {
                await userEvent.click(screen.getByLabelText('Close dialog'));
            });

            expect(confirmSpy).toHaveBeenCalledWith(
                expect.stringContaining('unsaved changes')
            );
            expect(props.onClose).not.toHaveBeenCalled();
        } finally {
            confirmSpy.mockRestore();
        }
    });
});
