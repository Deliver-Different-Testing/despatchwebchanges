/** @jest-environment jest-environment-jsdom */

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {renderWithTheme} from '../../../__testUtils__';
import {WidgetPanel} from './WidgetPanel';
import {DispatchBox} from '../DispatchPage.interfaces';
import type {BoxConfig} from '../DispatchPage.interfaces';

const mockConfig: BoxConfig = {
    id: DispatchBox.JobsList,
    title: 'Job List',
    icon: 'list_alt',
    showRefresh: true,
    description: 'Test description',
};

const defaultProps = {
    config: mockConfig,
    isDefaultLayout: true,
    children: <div data-testid="child-content">Child Content</div>,
};

describe('WidgetPanel', () => {
    it('renders title from config', () => {
        renderWithTheme(<WidgetPanel {...defaultProps} />);
        expect(screen.getByText('Job List')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
        renderWithTheme(<WidgetPanel {...defaultProps} subtitle=" - Selected" />);
        expect(screen.getByText('- Selected')).toBeInTheDocument();
    });

    it('does not render subtitle when not provided', () => {
        renderWithTheme(<WidgetPanel {...defaultProps} />);
        expect(screen.queryByText('- Selected')).not.toBeInTheDocument();
    });

    it('renders children content', () => {
        renderWithTheme(<WidgetPanel {...defaultProps} />);
        expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('shows refresh button when showRefresh and onRefresh provided', () => {
        const onRefresh = jest.fn();
        renderWithTheme(<WidgetPanel {...defaultProps} onRefresh={onRefresh} />);
        expect(screen.getByLabelText('Refresh Job List')).toBeInTheDocument();
    });

    it('does not show refresh button when showRefresh is false', () => {
        const noRefreshConfig = {...mockConfig, showRefresh: false};
        renderWithTheme(
            <WidgetPanel {...defaultProps} config={noRefreshConfig} onRefresh={jest.fn()} />
        );
        expect(screen.queryByLabelText('Refresh Job List')).not.toBeInTheDocument();
    });

    it('calls onRefresh when refresh button clicked', () => {
        const onRefresh = jest.fn();
        renderWithTheme(<WidgetPanel {...defaultProps} onRefresh={onRefresh} />);
        fireEvent.click(screen.getByLabelText('Refresh Job List'));
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('shows drag handle when not default layout', () => {
        renderWithTheme(<WidgetPanel {...defaultProps} isDefaultLayout={false} />);
        expect(document.querySelector('.drag-handle')).toBeInTheDocument();
    });

    it('hides drag handle when default layout', () => {
        renderWithTheme(<WidgetPanel {...defaultProps} isDefaultLayout={true} />);
        expect(document.querySelector('.drag-handle')).not.toBeInTheDocument();
    });

    it('renders toolbar content when provided', () => {
        renderWithTheme(
            <WidgetPanel {...defaultProps} toolbarContent={<span data-testid="tb-content">Extra</span>} />
        );
        expect(screen.getByTestId('tb-content')).toBeInTheDocument();
    });

    it('renders toolbar actions when provided', () => {
        renderWithTheme(
            <WidgetPanel {...defaultProps} toolbarActions={<button data-testid="tb-action">Act</button>} />
        );
        expect(screen.getByTestId('tb-action')).toBeInTheDocument();
    });
});
