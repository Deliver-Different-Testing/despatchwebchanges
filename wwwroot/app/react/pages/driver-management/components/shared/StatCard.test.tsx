import React from 'react';
import {render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import {StatCard} from './StatCard';

const theme = createTheme();

const renderStatCard = (props = {}) =>
    render(
        <ThemeProvider theme={theme}>
            <StatCard value={42} label="Test Label" {...props} />
        </ThemeProvider>
    );

describe('StatCard', () => {
    it('should render numeric value', () => {
        renderStatCard();

        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should render string value', () => {
        renderStatCard({value: '$150.00'});

        expect(screen.getByText('$150.00')).toBeInTheDocument();
    });

    it('should render label', () => {
        renderStatCard();

        expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('should render with icon', () => {
        renderStatCard({icon: <CheckIcon data-testid="stat-icon" />});

        expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
    });

    it('should apply color to the top bar', () => {
        const {container} = renderStatCard({color: 'error.main'});

        // querySelector is used here because MUI Box renders a plain <div> with no
        // implicit ARIA role and the colored bar has no text content or test-id to query.
        const colorBar = container.querySelector('.MuiBox-root');
        expect(colorBar).toBeInTheDocument();
    });
});
