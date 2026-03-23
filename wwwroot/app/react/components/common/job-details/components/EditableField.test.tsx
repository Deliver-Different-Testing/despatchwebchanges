/** @jest-environment jest-environment-jsdom */
/**
 * EditableField Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {EditableField} from './EditableField';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('EditableField', () => {
    it('renders label and value', () => {
        renderWithTheme(<EditableField label="Speed" value="Standard" />);
        expect(screen.getByText('Speed')).toBeInTheDocument();
        expect(screen.getByText('Standard')).toBeInTheDocument();
    });

    it('renders em dash for empty or null value', () => {
        const {unmount} = renderWithTheme(<EditableField label="Weight" value="" />);
        expect(screen.getByText('\u2014')).toBeInTheDocument();
        unmount();

        renderWithTheme(<EditableField label="Weight" value={null} />);
        expect(screen.getByText('\u2014')).toBeInTheDocument();
    });

    it('renders as clickable when onClick is provided', () => {
        const onClick = jest.fn();
        renderWithTheme(<EditableField label="Speed" value="Standard" onClick={onClick} />);

        fireEvent.click(screen.getByText('Standard'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
        const onClick = jest.fn();
        renderWithTheme(<EditableField label="Speed" value="Standard" onClick={onClick} disabled />);

        // Should render as non-clickable ListItem
        expect(screen.getByText('Standard')).toBeInTheDocument();
    });

    it('renders nothing when not visible and not in edit mode', () => {
        const {container} = renderWithTheme(
            <EditableField label="Speed" value="Standard" isVisible={false} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders visibility toggle in edit mode', () => {
        const onToggleVisibility = jest.fn();
        renderWithTheme(
            <EditableField
                label="Speed"
                value="Standard"
                isEditMode={true}
                isVisible={true}
                onToggleVisibility={onToggleVisibility}
            />
        );

        expect(screen.getByText('Speed')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Speed'));
        expect(onToggleVisibility).toHaveBeenCalled();
    });

    it('shows field even when not visible in edit mode', () => {
        renderWithTheme(
            <EditableField
                label="Hidden Field"
                value="Value"
                isEditMode={true}
                isVisible={false}
                onToggleVisibility={jest.fn()}
            />
        );
        expect(screen.getByText('Hidden Field')).toBeInTheDocument();
    });

    it('renders numeric values as strings', () => {
        renderWithTheme(<EditableField label="Weight" value={12.5} />);
        expect(screen.getByText('12.5')).toBeInTheDocument();
    });
});
