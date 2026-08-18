/**
 * DispatchDialog tests
 *
 * Covers the universal dispatch dialog's radio-switching behaviour, DFRNT
 * Partner disable rule + tooltip, confirm callbacks for both courier and
 * partner paths, and bulk-mode subtitle.
 */

import React from 'react';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {DispatchDialog} from './DispatchDialog';
import type {DispatchDialogProps, DispatchMode} from './types';
import {renderWithMantine, renderWithMantineProviders} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import type {PartnerRateForJobResponse, EventGroupItem} from '../../../services/jobListApi';
import type {ISuggestion} from '../../../../interfaces/job.interface';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockCourierResults: ISuggestion[] = [
    {id: 101, text: 'ABC Couriers'},
    {id: 102, text: 'XYZ Logistics'},
];

const mockAgentResults: ISuggestion[] = [
    {id: 201, text: 'AgentOne'},
];

const mockNpResults: ISuggestion[] = [
    {id: 301, text: 'NetworkPartnerCo'},
];

jest.mock('../../../services/jobDetailApi', () => ({
    autocompleteSearch: jest.fn(),
}));

jest.mock('../../../services/apiClient', () => ({
    apiClient: {
        get: jest.fn(),
    },
}));

// AgentEmailFields (rendered for a chosen Agent on a single job) fetches the inbound-email
// preview via this service. Mock it so agent-email cases can drive willEmail/defaults.
jest.mock('../../../services/dispatchExecutorApi', () => ({
    getAgentInboundEmailPreview: jest.fn(),
}));

import {autocompleteSearch} from '../../../services/jobDetailApi';
import {apiClient} from '../../../services/apiClient';
import {getAgentInboundEmailPreview} from '../../../services/dispatchExecutorApi';

const mockedAutocompleteSearch = autocompleteSearch as jest.Mock;
const mockedApiClientGet = apiClient.get as jest.Mock;
const mockPreview = getAgentInboundEmailPreview as jest.Mock;

const rateCardResponse: PartnerRateForJobResponse = {
    rateCardRate: 85.00,
    liveQuotes: [],
    source: 'rate_card',
};

const mockPartners: EventGroupItem[] = [
    {id: 7, text: 'PartnerCo'},
    {id: 8, text: 'OtherPartner'},
];

// ── Helpers ───────────────────────────────────────────────────────────

const singleStandardMode: DispatchMode = {
    kind: 'single',
    jobId: 42,
    jobNo: 'J042',
    flags: {isArchived: false, isBulkJob: false, preBook: false},
};

function makeProps(overrides: Partial<DispatchDialogProps> = {}): DispatchDialogProps {
    return {
        open: true,
        mode: singleStandardMode,
        onClose: jest.fn(),
        onDispatchCourier: jest.fn().mockResolvedValue(undefined),
        onSendToPartner: jest.fn().mockResolvedValue(undefined),
        fetchRate: jest.fn().mockResolvedValue(rateCardResponse),
        getPartnerOptions: jest.fn().mockResolvedValue(mockPartners),
        ...overrides,
    };
}

// Drives the dialog through the Courier path: type into the search box,
// pick the first matching courier, and click Confirm.
async function pickCourierAndConfirm() {
    const search = screen.getByPlaceholderText(/Search courier/);
    fireEvent.focus(search);
    fireEvent.change(search, {target: {value: 'ABC'}});
    const option = await screen.findByRole('option', {name: /ABC Couriers/});
    fireEvent.click(option);
    fireEvent.click(screen.getByRole('button', {name: /Dispatch/}));
}

beforeEach(() => {
    mockedAutocompleteSearch.mockReset();
    mockedApiClientGet.mockReset();
    mockPreview.mockReset();
    mockedAutocompleteSearch.mockResolvedValue(mockCourierResults);
    mockedApiClientGet.mockImplementation((_url: string, params: {isNetworkPartner: boolean}) => {
        return Promise.resolve(params.isNetworkPartner ? mockNpResults : mockAgentResults);
    });
    // Default: no email will be sent — agent-email cases override per test.
    mockPreview.mockResolvedValue({status: 'NoAgentEmail', agentEmail: null, willEmail: false});
});

// ── Tests ─────────────────────────────────────────────────────────────

describe('DispatchDialog', () => {
    describe('Layout & basic rendering', () => {
        it('renders the four Type radios', () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);

            expect(screen.getByRole('radio', {name: /Courier/})).toBeInTheDocument();
            expect(screen.getByRole('radio', {name: /Agent/})).toBeInTheDocument();
            expect(screen.getByRole('radio', {name: /^NP$/})).toBeInTheDocument();
            expect(screen.getByRole('radio', {name: /DFRNT Partner/})).toBeInTheDocument();
        });

        it('shows the single-job subtitle as "Job {jobNo}"', () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);
            expect(screen.getByText(/Job J042/)).toBeInTheDocument();
        });

        it('shows the bulk subtitle as "{N} jobs selected"', () => {
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({
                        mode: {
                            kind: 'bulk',
                            jobs: [
                                {id: 1, jobNo: 'J001'},
                                {id: 2, jobNo: 'J002'},
                                {id: 3, jobNo: 'J003'},
                            ],
                        },
                    })}
                />,
            );
            expect(screen.getByText(/3 jobs selected/)).toBeInTheDocument();
        });

        it('shows a singular subtitle when the bulk selection has one job', () => {
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({mode: {kind: 'bulk', jobs: [{id: 1, jobNo: 'J001'}]}})}
                />,
            );
            expect(screen.getByText(/1 job selected/)).toBeInTheDocument();
        });

        it('honours initialType when DFRNT Partner is enabled', () => {
            renderWithMantine(<DispatchDialog {...makeProps({initialType: 'DfrntPartner'})} />);
            expect(screen.getByRole('radio', {name: /DFRNT Partner/})).toBeChecked();
        });

        it('falls back to Courier when initialType is DFRNT Partner but the radio is disabled', () => {
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({
                        initialType: 'DfrntPartner',
                        mode: {kind: 'recurring', jobId: 1, jobNo: 'R001'},
                    })}
                />,
            );
            expect(screen.getByRole('radio', {name: /Courier/})).toBeChecked();
        });
    });

    describe('DFRNT Partner disable rule', () => {
        const cases: Array<{label: string; mode: DispatchMode; tooltip: RegExp}> = [
            {
                label: 'bulk mode',
                mode: {kind: 'bulk', jobs: [{id: 1, jobNo: 'J001'}, {id: 2, jobNo: 'J002'}]},
                tooltip: /bulk dispatch/i,
            },
            {
                label: 'recurring mode',
                mode: {kind: 'recurring', jobId: 1, jobNo: 'R001'},
                tooltip: /recurring jobs/i,
            },
            {
                label: 'archived single job',
                mode: {
                    kind: 'single',
                    jobId: 1,
                    jobNo: 'J001',
                    flags: {isArchived: true, isBulkJob: false, preBook: false},
                },
                tooltip: /archived jobs/i,
            },
            {
                label: 'bulk-flag single job',
                mode: {
                    kind: 'single',
                    jobId: 1,
                    jobNo: 'J001',
                    flags: {isArchived: false, isBulkJob: true, preBook: false},
                },
                tooltip: /bulk jobs/i,
            },
            {
                label: 'prebook (recurring) single job',
                mode: {
                    kind: 'single',
                    jobId: 1,
                    jobNo: 'J001',
                    flags: {isArchived: false, isBulkJob: false, preBook: true},
                },
                tooltip: /recurring jobs/i,
            },
        ];

        for (const {label, mode, tooltip} of cases) {
            it(`disables DFRNT Partner with the right tooltip for ${label}`, async () => {
                const user = setupUser();
                renderWithMantine(<DispatchDialog {...makeProps({mode})} />);
                const dfrntRadio = screen.getByRole('radio', {name: /DFRNT Partner/});
                expect(dfrntRadio).toBeDisabled();

                // Tooltip wrapper is a sibling span — hover the label text to fire the tooltip.
                const labelEl = screen.getByText('DFRNT Partner');
                await user.hover(labelEl);
                await waitFor(
                    () => {
                        expect(screen.getByRole('tooltip')).toHaveTextContent(tooltip);
                    },
                    {timeout: 3000},
                );
            });
        }

        it('enables DFRNT Partner for a standard non-archived non-bulk non-prebook tucJob', () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);
            expect(screen.getByRole('radio', {name: /DFRNT Partner/})).not.toBeDisabled();
        });
    });

    describe('Destination panels', () => {
        it('shows the Courier autocomplete by default and fires the courier search backend', async () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);

            const search = screen.getByPlaceholderText(/Search courier/);
            fireEvent.focus(search);
            fireEvent.change(search, {target: {value: 'ABC'}});

            await waitFor(() => {
                expect(mockedAutocompleteSearch).toHaveBeenCalledWith('ABC', '/courier/AllActiveSearch');
            });
        });

        it('switches to the Agent search backend when the Agent radio is selected', async () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);

            fireEvent.click(screen.getByRole('radio', {name: /Agent/}));
            const search = screen.getByPlaceholderText(/Search agent/);
            fireEvent.focus(search);
            fireEvent.change(search, {target: {value: 'One'}});

            await waitFor(() => {
                expect(mockedApiClientGet).toHaveBeenCalledWith(
                    '/NationwideJob/GetAllAgentsSearch',
                    expect.objectContaining({searchTerm: 'One', isNetworkPartner: false}),
                );
            });
        });

        it('switches to the NP search backend when the NP radio is selected', async () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);

            fireEvent.click(screen.getByRole('radio', {name: /^NP$/}));
            const search = screen.getByPlaceholderText(/Search Network Partner/);
            fireEvent.focus(search);
            fireEvent.change(search, {target: {value: 'Net'}});

            await waitFor(() => {
                expect(mockedApiClientGet).toHaveBeenCalledWith(
                    '/NationwideJob/GetAllAgentsSearch',
                    expect.objectContaining({searchTerm: 'Net', isNetworkPartner: true}),
                );
            });
        });

        it('switching radio clears the previous destination so we never submit the wrong column', () => {
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({existingDestination: {id: 50, text: 'ABC Couriers'}})}
                />,
            );

            const search = screen.getByPlaceholderText(/Search courier/) as HTMLInputElement;
            expect(search.value).toBe('ABC Couriers');

            fireEvent.click(screen.getByRole('radio', {name: /Agent/}));
            const newSearch = screen.getByPlaceholderText(/Search agent/) as HTMLInputElement;
            expect(newSearch.value).toBe('');
        });

        it('shows the partner select + lazy-loads partners when DFRNT Partner is selected', async () => {
            const getPartnerOptions = jest.fn().mockResolvedValue(mockPartners);
            renderWithMantine(<DispatchDialog {...makeProps({getPartnerOptions})} />);

            fireEvent.click(screen.getByRole('radio', {name: /DFRNT Partner/}));

            await waitFor(() => {
                expect(getPartnerOptions).toHaveBeenCalled();
            });
            // Exact string label disambiguates from the "DFRNT Partner" radio label.
            expect(screen.getByLabelText('Partner')).toBeInTheDocument();
        });
    });

    describe('Confirm callbacks', () => {
        it('calls onDispatchCourier with the picked courier when Confirm is clicked', async () => {
            const onDispatchCourier = jest.fn().mockResolvedValue(undefined);
            renderWithMantine(<DispatchDialog {...makeProps({onDispatchCourier})} />);

            await pickCourierAndConfirm();

            await waitFor(() => {
                expect(onDispatchCourier).toHaveBeenCalledWith({
                    type: 'Courier',
                    destination: {id: 101, text: 'ABC Couriers'},
                });
            });
        });

        it('Confirm button stays disabled until a destination is picked', async () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);
            const confirm = screen.getByRole('button', {name: /Dispatch/});
            expect(confirm).toBeDisabled();
        });

        it('surfaces an error from onDispatchCourier inline without closing the dialog', async () => {
            const onDispatchCourier = jest.fn().mockRejectedValue(new Error('server-side failure'));
            renderWithMantine(<DispatchDialog {...makeProps({onDispatchCourier})} />);

            await pickCourierAndConfirm();

            expect(await screen.findByText(/server-side failure/)).toBeInTheDocument();
            // Dialog is still open.
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('calls onSendToPartner with partner + rate when DFRNT Partner Confirm is clicked', async () => {
            const onSendToPartner = jest.fn().mockResolvedValue(undefined);
            renderWithMantine(<DispatchDialog {...makeProps({onSendToPartner})} />);

            fireEvent.click(screen.getByRole('radio', {name: /DFRNT Partner/}));

            // The Partner Select stays disabled until getPartnerOptions resolves;
            // wait for it to enable before opening (Mantine's Select opens on click).
            const select = await screen.findByRole('combobox', {name: 'Partner'});
            await waitFor(() => expect(select).toBeEnabled());
            fireEvent.click(select);
            const partnerOption = await screen.findByRole('option', {name: 'PartnerCo'});
            fireEvent.click(partnerOption);

            // Wait for the rate panel to load + pre-fill the Agreed Rate input.
            const rateInput = await screen.findByLabelText(/Agreed Rate/) as HTMLInputElement;
            await waitFor(() => expect(rateInput.value).toBe('85.00'));

            fireEvent.click(screen.getByRole('button', {name: /Send to Partner/}));

            await waitFor(() => {
                expect(onSendToPartner).toHaveBeenCalledWith({id: 7, text: 'PartnerCo'}, 85);
            });
        });

        it('Cancel button calls onClose', () => {
            const onClose = jest.fn();
            renderWithMantine(<DispatchDialog {...makeProps({onClose})} />);

            fireEvent.click(screen.getByRole('button', {name: /Cancel/}));
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Confirm button label', () => {
        it('reads "Dispatch" for the Courier radio', () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);
            expect(screen.getByRole('button', {name: /^Dispatch$/})).toBeInTheDocument();
        });

        it('reads "Send to Agent" when the Agent radio is selected', () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);

            fireEvent.click(screen.getByRole('radio', {name: /Agent/}));
            expect(within(screen.getByRole('dialog')).getByRole('button', {name: /^Send to Agent$/})).toBeInTheDocument();
        });

        it('reads "Send to NP" when the NP radio is selected', () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);

            fireEvent.click(screen.getByRole('radio', {name: /^NP$/}));
            expect(within(screen.getByRole('dialog')).getByRole('button', {name: /^Send to NP$/})).toBeInTheDocument();
        });

        it('reads "Send to Partner" when the DFRNT Partner radio is selected', () => {
            renderWithMantine(<DispatchDialog {...makeProps()} />);

            fireEvent.click(screen.getByRole('radio', {name: /DFRNT Partner/}));
            // The footer button label is the disabled state until a partner is picked.
            expect(within(screen.getByRole('dialog')).getByRole('button', {name: /Send to Partner/})).toBeInTheDocument();
        });
    });

    describe('Unassign courier action', () => {
        const recurringMode: DispatchMode = {kind: 'recurring', jobId: 7, jobNo: 'R007'};
        const assignedCourier: ISuggestion = {id: 50, text: 'ABC Couriers'};

        it('shows "Unassign courier" for a recurring job that already has a courier', () => {
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({
                        mode: recurringMode,
                        existingDestination: assignedCourier,
                        onUnassignCourier: jest.fn().mockResolvedValue(undefined),
                    })}
                />,
            );
            expect(screen.getByRole('button', {name: /Unassign courier/})).toBeInTheDocument();
        });

        it('hides "Unassign courier" for a recurring job with no courier assigned', () => {
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({
                        mode: recurringMode,
                        onUnassignCourier: jest.fn().mockResolvedValue(undefined),
                    })}
                />,
            );
            expect(screen.queryByRole('button', {name: /Unassign courier/})).not.toBeInTheDocument();
        });

        it('hides "Unassign courier" for a single (non-recurring) job even with a courier', () => {
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({
                        existingDestination: assignedCourier,
                        onUnassignCourier: jest.fn().mockResolvedValue(undefined),
                    })}
                />,
            );
            expect(screen.queryByRole('button', {name: /Unassign courier/})).not.toBeInTheDocument();
        });

        it('hides "Unassign courier" once a non-Courier type is selected', () => {
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({
                        mode: recurringMode,
                        existingDestination: assignedCourier,
                        onUnassignCourier: jest.fn().mockResolvedValue(undefined),
                    })}
                />,
            );
            fireEvent.click(screen.getByRole('radio', {name: /Agent/}));
            expect(screen.queryByRole('button', {name: /Unassign courier/})).not.toBeInTheDocument();
        });

        it('explains that unassigning also clears upcoming created jobs while completed jobs keep their courier', () => {
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({
                        mode: recurringMode,
                        existingDestination: assignedCourier,
                        onUnassignCourier: jest.fn().mockResolvedValue(undefined),
                    })}
                />,
            );
            expect(
                screen.getByText(/upcoming jobs already created that aren't completed yet/i),
            ).toBeInTheDocument();
            expect(screen.getByText(/Completed jobs\s+keep their assigned courier/i)).toBeInTheDocument();
        });

        it('calls onUnassignCourier when the action is clicked', async () => {
            const onUnassignCourier = jest.fn().mockResolvedValue(undefined);
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({mode: recurringMode, existingDestination: assignedCourier, onUnassignCourier})}
                />,
            );

            fireEvent.click(screen.getByRole('button', {name: /Unassign courier/}));

            await waitFor(() => {
                expect(onUnassignCourier).toHaveBeenCalled();
            });
        });

        it('surfaces an error from onUnassignCourier inline without closing the dialog', async () => {
            const onUnassignCourier = jest.fn().mockRejectedValue(new Error('unassign blew up'));
            renderWithMantine(
                <DispatchDialog
                    {...makeProps({mode: recurringMode, existingDestination: assignedCourier, onUnassignCourier})}
                />,
            );

            fireEvent.click(screen.getByRole('button', {name: /Unassign courier/}));

            expect(await screen.findByText(/unassign blew up/)).toBeInTheDocument();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    describe('Agent email template', () => {
        const DEFAULT_SUBJECT = 'New job assigned [JobNumber]';
        const DEFAULT_BODY = 'Hi [AgentName]\n\nYou have been assigned a new job [JobNumber]. [InboundUrl]';

        // Select the Agent radio and pick AgentOne so AgentEmailFields mounts (single job).
        async function pickAgent() {
            fireEvent.click(screen.getByRole('radio', {name: /Agent/}));
            const search = screen.getByPlaceholderText(/Search agent/);
            fireEvent.focus(search);
            fireEvent.change(search, {target: {value: 'One'}});
            const option = await screen.findByRole('option', {name: /AgentOne/});
            fireEvent.click(option);
        }

        it('shows the editable Subject/Message fields seeded from defaults and forwards the edits on confirm', async () => {
            const user = setupUser();
            const onDispatchCourier = jest.fn().mockResolvedValue(undefined);
            mockPreview.mockResolvedValue({
                status: 'Queued',
                agentEmail: 'agent@example.com',
                willEmail: true,
                defaultSubject: DEFAULT_SUBJECT,
                defaultBody: DEFAULT_BODY,
            });

            renderWithMantineProviders(<DispatchDialog {...makeProps({onDispatchCourier})} />);

            await pickAgent();

            expect(await screen.findByLabelText('Subject')).toHaveValue(DEFAULT_SUBJECT);
            const bodyInput = screen.getByLabelText('Message');
            expect(bodyInput).toHaveValue(DEFAULT_BODY);

            await user.clear(bodyInput);
            await user.click(bodyInput);
            await user.paste('Edited body for the agent');

            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: /^Send to Agent$/}));

            await waitFor(() => {
                expect(onDispatchCourier).toHaveBeenCalledWith({
                    type: 'Agent',
                    destination: {id: 201, text: 'AgentOne'},
                    emailSubject: DEFAULT_SUBJECT,
                    emailBody: 'Edited body for the agent',
                });
            });
        });

        it('hides the fields and forwards undefined overrides when no email will be sent', async () => {
            const onDispatchCourier = jest.fn().mockResolvedValue(undefined);
            mockPreview.mockResolvedValue({status: 'NoAgentEmail', agentEmail: null, willEmail: false});

            renderWithMantineProviders(<DispatchDialog {...makeProps({onDispatchCourier})} />);

            await pickAgent();

            expect(await screen.findByText(/no email address on file/i)).toBeInTheDocument();
            expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();

            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: /^Send to Agent$/}));

            await waitFor(() => {
                expect(onDispatchCourier).toHaveBeenCalledWith({
                    type: 'Agent',
                    destination: {id: 201, text: 'AgentOne'},
                });
            });
        });

        it('offers the stop-job cascade only when the job actually has stop jobs, and forwards the choice', async () => {
            const onDispatchCourier = jest.fn().mockResolvedValue(undefined);

            const {unmount} = renderWithMantineProviders(
                <DispatchDialog {...makeProps({onDispatchCourier, stopJobCount: 0})} />
            );
            await pickAgent();
            expect(screen.queryByRole('checkbox', {name: /stop job/i})).not.toBeInTheDocument();
            unmount();

            renderWithMantineProviders(
                <DispatchDialog {...makeProps({onDispatchCourier, stopJobCount: 3})} />
            );
            await pickAgent();

            const cascade = screen.getByRole('checkbox', {name: /3 stop job/i});
            expect(cascade).not.toBeChecked();
            fireEvent.click(cascade);

            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: /^Send to Agent$/}));

            await waitFor(() => {
                expect(onDispatchCourier).toHaveBeenCalledWith({
                    type: 'Agent',
                    destination: {id: 201, text: 'AgentOne'},
                    includeStopJobs: true,
                });
            });
        });

        it('captures an AWB alongside the assignment, and locks it when the job already has one', async () => {
            const user = setupUser();
            const onDispatchCourier = jest.fn().mockResolvedValue(undefined);

            const {unmount} = renderWithMantineProviders(
                <DispatchDialog {...makeProps({onDispatchCourier, existingConNote: 'AWB-EXISTING'})} />
            );
            await pickAgent();
            expect(screen.getByLabelText(/AWB Number/i)).toBeDisabled();
            unmount();

            renderWithMantineProviders(<DispatchDialog {...makeProps({onDispatchCourier})} />);
            await pickAgent();

            const awb = screen.getByLabelText(/AWB Number/i);
            expect(awb).toBeEnabled();
            await user.click(awb);
            await user.paste('123-45678901');

            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: /^Send to Agent$/}));

            await waitFor(() => {
                expect(onDispatchCourier).toHaveBeenCalledWith({
                    type: 'Agent',
                    destination: {id: 201, text: 'AgentOne'},
                    awb: '123-45678901',
                });
            });
        });
    });

    describe('network partner sessions', () => {
        it('offers a network partner nothing but their own couriers', () => {
            renderWithMantine(<DispatchDialog {...makeProps({isNetworkPartner: true})} />);

            // A network partner dispatches within their own fleet; handing a job on to
            // an agent, another partner, or a DFRNT tenant is a tenant-staff action.
            expect(screen.getByRole('radio', {name: /Courier/})).toBeInTheDocument();
            expect(screen.queryByRole('radio', {name: /^Agent$/})).not.toBeInTheDocument();
            expect(screen.queryByRole('radio', {name: /^NP$/})).not.toBeInTheDocument();
            expect(screen.queryByRole('radio', {name: /DFRNT Partner/})).not.toBeInTheDocument();
        });

        it('still opens on Courier when a caller asks for a type the partner cannot use', () => {
            renderWithMantine(
                <DispatchDialog {...makeProps({isNetworkPartner: true, initialType: 'Agent'})} />
            );

            expect(screen.getByPlaceholderText(/Search courier/)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /^Dispatch$/})).toBeInTheDocument();
        });
    });
    describe('unserviceable partner lane', () => {
        const unserviceableRate = {
            rateCardRate: 85.00,
            liveQuotes: [],
            source: 'rate_card' as const,
            serviceAvailable: false,
            serviceabilityMessage: "Partner reports service 'STD' is not available on this route.",
            alternatives: [
                {jobTypeId: 11, partnerServiceCode: 'OVERNIGHT', serviceName: 'Overnight', totalCharge: 24.50, currency: 'NZD', transitDays: 1},
            ],
        };

        async function openPartnerTabWith(rate: unknown) {
            renderWithMantine(<DispatchDialog {...makeProps({fetchRate: jest.fn().mockResolvedValue(rate)})} />);
            fireEvent.click(screen.getByRole('radio', {name: /DFRNT Partner/}));
            // The Partner Select stays disabled until getPartnerOptions resolves.
            const select = await screen.findByRole('combobox', {name: 'Partner'});
            await waitFor(() => expect(select).toBeEnabled());
            fireEvent.click(select);
            fireEvent.click(await screen.findByRole('option', {name: 'PartnerCo'}));
        }

        it('reframes the confirm button as "Send anyway" when the partner cannot carry the route', async () => {
            await openPartnerTabWith(unserviceableRate);

            expect(await screen.findByRole('button', {name: /Send anyway/})).toBeInTheDocument();
        });

        it('keeps the normal label when the route is fine', async () => {
            await openPartnerTabWith({...unserviceableRate, serviceAvailable: true, alternatives: []});

            expect(await screen.findByRole('button', {name: /Send to Partner/})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /Send anyway/})).not.toBeInTheDocument();
        });
    });
});
