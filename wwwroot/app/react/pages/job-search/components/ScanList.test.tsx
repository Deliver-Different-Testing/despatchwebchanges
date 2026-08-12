import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {ScanList} from './ScanList';
import {useScanDetail} from '../hooks/useScanDetail';
import type {ScanDetailRecord} from '../../../services/jobSearchApi';

jest.mock('../hooks/useScanDetail');

const mockUseScanDetail = useScanDetail as jest.MockedFunction<typeof useScanDetail>;


const scan: ScanDetailRecord = {
    bulkScanId: 1,
    scanDateTime: '2024-01-15T14:30:00',
    scanDetail: 'Picked up',
    courier: 'Jane',
} as ScanDetailRecord;

const originalServerConfig = (window as any).serverConfig;

const renderList = () =>
    renderWithMantine(<ScanList jobId={99} runDate="2024-01-15" />);

describe('ScanList date format', () => {
    beforeEach(() => {
        mockUseScanDetail.mockReturnValue({
            scans: [scan],
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
    });

    afterEach(() => {
        (window as any).serverConfig = originalServerConfig;
        jest.clearAllMocks();
    });

    it('renders US month-first format for US tenants', () => {
        (window as any).serverConfig = {isUSCustomer: true};
        renderList();
        expect(screen.getByText(/Jan\/15\/2024 2:30 PM/)).toBeInTheDocument();
    });

    it('renders NZ day-first format for non-US tenants', () => {
        (window as any).serverConfig = {isUSCustomer: false};
        renderList();
        expect(screen.getByText(/15\/Jan\/2024 14:30/)).toBeInTheDocument();
    });
});
