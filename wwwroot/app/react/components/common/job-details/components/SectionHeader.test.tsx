/**
 * SectionHeader Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import RepeatIcon from '@mui/icons-material/Repeat';
import {SectionHeader} from './SectionHeader';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('SectionHeader', () => {
    it('renders title and the leading icon', () => {
        renderWithTheme(<SectionHeader icon={RepeatIcon} title="Recurring Schedule" />);
        expect(screen.getByText('Recurring Schedule')).toBeInTheDocument();
        const svg = document.querySelector('svg');
        expect(svg).not.toBeNull();
    });

    it('omits the subtitle row when no subtitle is provided', () => {
        renderWithTheme(<SectionHeader icon={RepeatIcon} title="Recurring Schedule" />);
        expect(screen.queryByText('When this job repeats')).not.toBeInTheDocument();
    });

    it('renders the subtitle when provided', () => {
        renderWithTheme(
            <SectionHeader icon={RepeatIcon} title="Recurring Schedule" subtitle="When this job repeats" />
        );
        expect(screen.getByText('When this job repeats')).toBeInTheDocument();
    });

    it('renders the endAction slot and forwards clicks', () => {
        const onClick = jest.fn();
        renderWithTheme(
            <SectionHeader
                icon={RepeatIcon}
                title="Schedule"
                endAction={
                    <IconButton aria-label="toggle visibility" size="small" onClick={onClick} />
                }
            />
        );
        fireEvent.click(screen.getByLabelText('toggle visibility'));
        expect(onClick).toHaveBeenCalled();
    });

    it.each(['primary', 'pickup', 'delivery'] as const)(
        'renders without error for variant=%s',
        (variant) => {
            renderWithTheme(<SectionHeader icon={RepeatIcon} title="Section" variant={variant} />);
            expect(screen.getByText('Section')).toBeInTheDocument();
        },
    );
});
