import type {MockedFunction} from 'vitest';
import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithMantine} from '../../../test/utils';
import {ScanList} from './ScanList';
import {useScanDetail} from '../hooks/useScanDetail';
import type {ScanDetailRecord} from '../../../api/jobSearchApi';

vi.mock('../hooks/useScanDetail');

const mockUseScanDetail = useScanDetail as MockedFunction<typeof useScanDetail>;


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
            refetch: vi.fn(),
        });
    });

    afterEach(() => {
        (window as any).serverConfig = originalServerConfig;
        vi.clearAllMocks();
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

describe('ScanList fetch failure', () => {
    it('reports the failure instead of an empty scan history', () => {
        mockUseScanDetail.mockReturnValue({scans: [], isLoading: false, isError: true, refetch: vi.fn()});
        renderList();
        expect(screen.getByText("Couldn't load scan records")).toBeInTheDocument();
        expect(screen.queryByText('No scan records yet')).not.toBeInTheDocument();
    });
});
