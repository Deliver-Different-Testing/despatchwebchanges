import React from 'react';
import {screen} from '@testing-library/react';
import {SplitJobProgressDialog} from './SplitJobProgressDialog';
import {renderWithMantine} from '../../../__testUtils__';

describe('SplitJobProgressDialog', () => {
    it('renders the header, job number, and a progress bar when open', () => {
        renderWithMantine(<SplitJobProgressDialog open jobNo="JOB-001"/>);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Splitting Job'})).toBeInTheDocument();
        expect(screen.getByText('Job JOB-001')).toBeInTheDocument();
        expect(screen.getByText(/Splitting job JOB-001/)).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('has no close button (not dismissable)', () => {
        renderWithMantine(<SplitJobProgressDialog open jobNo="JOB-001"/>);
        expect(screen.queryByRole('button', {name: /close dialog/i})).not.toBeInTheDocument();
    });

    it('does not render when closed', () => {
        renderWithMantine(<SplitJobProgressDialog open={false} jobNo="JOB-001"/>);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
