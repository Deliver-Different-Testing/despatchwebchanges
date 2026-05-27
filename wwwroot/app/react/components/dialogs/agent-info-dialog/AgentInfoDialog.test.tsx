/**
 * AgentInfoDialog Component Tests
 */

import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentInfoDialog, AgentInfo, AirportViewModel } from './AgentInfoDialog';
import { renderWithTheme, createProps } from '../../../__testUtils__';

const mockAirports: AirportViewModel[] = [
    {
        code: 'LAX',
        name: 'Los Angeles International Airport',
        city: 'Los Angeles',
        country: 'USA',
        timezone: 'America/Los_Angeles',
        elevation: 128,
        latitude: 33.9425,
        longitude: -118.4081,
    },
    {
        code: 'JFK',
        name: 'John F. Kennedy International Airport',
        city: 'New York',
        country: 'USA',
        timezone: 'America/New_York',
        elevation: 13,
        latitude: 40.6413,
        longitude: -73.7781,
    },
];

const mockAgent: AgentInfo = {
    agentId: 123,
    agentName: 'John Smith',
    agentRate: 150.5,
    agentRanking: '4',
    agentNotes: 'Reliable agent with excellent service record.',
    agentPhone: '5551234567',
    agentEmail: 'john.smith@example.com',
    airports: mockAirports,
    address: {
        addressLine1: '123 Main St',
        addressLine2: 'Suite 100',
        addressLine3: '',
        addressLine4: '',
        addressLine5: '',
        addressLine6: '',
        addressLine7: '',
        addressLine8: '',
        fullAddress: '123 Main St, Suite 100, Los Angeles, CA 90001',
    },
};

const defaultProps = {
    open: true,
    agent: mockAgent,
    isLoading: false,
    onClose: jest.fn(),
};

const createMockProps = (overrides?: Partial<typeof defaultProps>) =>
    createProps(defaultProps, overrides);

describe('AgentInfoDialog', () => {
    describe('Rendering', () => {
        it('renders dialog when open is true', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('does not render dialog when open is false', () => {
            const props = createMockProps({ open: false });
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('displays agent name in header', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            // Header now shows title and agent name separately
            expect(screen.getByText('Agent Details')).toBeInTheDocument();
            // Agent name appears in header subtitle and potentially elsewhere
            const agentNames = screen.getAllByText('John Smith');
            expect(agentNames.length).toBeGreaterThanOrEqual(1);
        });

        it('displays close button', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });

    describe('Loading State', () => {
        it('shows loading spinner when isLoading is true', () => {
            const props = createMockProps({ isLoading: true, agent: undefined });
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('does not show content when loading', () => {
            const props = createMockProps({ isLoading: true, agent: undefined });
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.queryByText('Basic Information')).not.toBeInTheDocument();
        });
    });

    describe('Agent Basic Information', () => {
        it('displays agent name', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            // Agent name appears in both header and content
            const agentNames = screen.getAllByText('John Smith');
            expect(agentNames.length).toBeGreaterThanOrEqual(1);
        });

        it('displays formatted rate with currency', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('$150.50')).toBeInTheDocument();
        });

        it('displays star rating', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            // 4 stars should be rendered
            const stars = screen.getAllByTestId('StarIcon');
            expect(stars).toHaveLength(4);
        });

        it('displays formatted phone number', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
        });

        it('displays email', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('john.smith@example.com')).toBeInTheDocument();
        });

        it('displays phone link with tel: href', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            const phoneLink = screen.getByText('(555) 123-4567').closest('a');
            expect(phoneLink).toHaveAttribute('href', 'tel:5551234567');
        });

        it('displays email link with mailto: href', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            const emailLink = screen.getByText('john.smith@example.com').closest('a');
            expect(emailLink).toHaveAttribute('href', 'mailto:john.smith@example.com');
        });
    });

    describe('Agent Address', () => {
        it('displays full address', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('123 Main St, Suite 100, Los Angeles, CA 90001')).toBeInTheDocument();
        });

        it('displays fallback when no address available', () => {
            const agentNoAddress = { ...mockAgent, address: undefined };
            const props = createMockProps({ agent: agentNoAddress });
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('No address available')).toBeInTheDocument();
        });
    });

    describe('Agent Notes', () => {
        it('displays agent notes', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('Reliable agent with excellent service record.')).toBeInTheDocument();
        });

        it('displays fallback when no notes available', () => {
            const agentNoNotes = { ...mockAgent, agentNotes: '' };
            const props = createMockProps({ agent: agentNoNotes });
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('No notes available.')).toBeInTheDocument();
        });
    });

    describe('Assigned Airports', () => {
        it('displays assigned airports section', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('Assigned Airports')).toBeInTheDocument();
        });

        it.each([
            ['airport codes', ['LAX', 'JFK']],
            ['airport names', ['Los Angeles International Airport', 'John F. Kennedy International Airport']],
            ['airport locations', ['Los Angeles, USA', 'New York, USA']],
            ['airport timezones', ['America/Los_Angeles', 'America/New_York']],
        ])('displays %s', (_, expectedTexts) => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expectedTexts.forEach(text => {
                expect(screen.getByText(text)).toBeInTheDocument();
            });
        });

        it('displays formatted coordinates', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText(/33.9425° N, 118.4081° W/)).toBeInTheDocument();
            expect(screen.getByText(/40.6413° N, 73.7781° W/)).toBeInTheDocument();
        });

        it.each([
            ['empty array', []],
            ['undefined', undefined],
        ])('displays empty state when airports is %s', (_, airports) => {
            const agentNoAirports = { ...mockAgent, airports };
            const props = createMockProps({ agent: agentNoAirports });
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('No airports assigned')).toBeInTheDocument();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            await user.click(screen.getByRole('button'));

            expect(props.onClose).toHaveBeenCalled();
        });
    });

    describe('No Agent Data', () => {
        it('displays message when no agent data is available', () => {
            const props = createMockProps({ agent: undefined, isLoading: false });
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('No agent data available')).toBeInTheDocument();
        });
    });

    describe('Missing Contact Information', () => {
        it('displays "Not provided" for missing phone', () => {
            const agentNoPhone = { ...mockAgent, agentPhone: undefined };
            const props = createMockProps({ agent: agentNoPhone });
            renderWithTheme(<AgentInfoDialog {...props} />);

            const phoneSection = screen.getByText('Phone').closest('div');
            expect(within(phoneSection!).getByText('Not provided')).toBeInTheDocument();
        });

        it('displays "Not provided" for missing email', () => {
            const agentNoEmail = { ...mockAgent, agentEmail: undefined };
            const props = createMockProps({ agent: agentNoEmail });
            renderWithTheme(<AgentInfoDialog {...props} />);

            const emailSection = screen.getByText('Email').closest('div');
            expect(within(emailSection!).getByText('Not provided')).toBeInTheDocument();
        });
    });

    describe('Phone Formatting', () => {
        it('formats 10-digit phone number correctly', () => {
            const props = createMockProps();
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
        });

        it('displays unformatted phone for non-10-digit numbers', () => {
            const agentIntlPhone = { ...mockAgent, agentPhone: '+44123456789' };
            const props = createMockProps({ agent: agentIntlPhone });
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.getByText('+44123456789')).toBeInTheDocument();
        });
    });

    describe('Ranking Display', () => {
        it('displays no stars for invalid ranking', () => {
            const agentNoRanking = { ...mockAgent, agentRanking: '' };
            const props = createMockProps({ agent: agentNoRanking });
            renderWithTheme(<AgentInfoDialog {...props} />);

            expect(screen.queryAllByTestId('StarIcon')).toHaveLength(0);
            expect(screen.getByText('No ranking')).toBeInTheDocument();
        });

        it('rounds ranking to nearest integer', () => {
            const agentDecimalRanking = { ...mockAgent, agentRanking: '3.6' };
            const props = createMockProps({ agent: agentDecimalRanking });
            renderWithTheme(<AgentInfoDialog {...props} />);

            // 3.6 rounds to 4 stars
            const stars = screen.getAllByTestId('StarIcon');
            expect(stars).toHaveLength(4);
        });
    });
});
