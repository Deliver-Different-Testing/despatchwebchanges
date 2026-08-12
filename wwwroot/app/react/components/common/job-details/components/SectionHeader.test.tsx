/**
 * SectionHeader Component Tests
 */

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {ActionIcon} from '@mantine/core';
import {Repeat} from 'lucide-react';
import {SectionHeader, sectionHeaderColors} from './SectionHeader';
import {renderWithMantine} from '../../../../__testUtils__';

describe('SectionHeader', () => {
    it('renders title and the leading icon', () => {
        renderWithMantine(<SectionHeader lucide={Repeat} title="Recurring Schedule" />);
        expect(screen.getByText('Recurring Schedule')).toBeInTheDocument();
        expect(document.querySelector('svg')).not.toBeNull();
    });

    it('sizes the glyph itself rather than leaving it to the call site', () => {
        const {unmount} = renderWithMantine(<SectionHeader lucide={Repeat} title="Section" />);
        expect(document.querySelector('svg')).toHaveAttribute('width', '20');
        unmount();

        renderWithMantine(<SectionHeader lucide={Repeat} title="Section" dense />);
        expect(document.querySelector('svg')).toHaveAttribute('width', '18');
    });

    it('omits the subtitle row when no subtitle is provided', () => {
        renderWithMantine(<SectionHeader lucide={Repeat} title="Recurring Schedule" />);
        expect(screen.queryByText('When this job repeats')).not.toBeInTheDocument();
    });

    it('renders the subtitle when provided', () => {
        renderWithMantine(
            <SectionHeader lucide={Repeat} title="Recurring Schedule" subtitle="When this job repeats" />
        );
        expect(screen.getByText('When this job repeats')).toBeInTheDocument();
    });

    it('renders the endAction slot and forwards clicks', () => {
        const onClick = jest.fn();
        renderWithMantine(
            <SectionHeader
                lucide={Repeat}
                title="Schedule"
                endAction={<ActionIcon aria-label="toggle visibility" size="sm" onClick={onClick} />}
            />
        );
        fireEvent.click(screen.getByLabelText('toggle visibility'));
        expect(onClick).toHaveBeenCalled();
    });

    /**
     * Pickup and delivery keep their map-convention fills; everything else is a
     * plain card bar so the section title reads as part of the card.
     */
    describe('surfaces', () => {
        const renderVariant = (variant: 'primary' | 'pickup' | 'delivery') => {
            const {unmount} = renderWithMantine(
                <SectionHeader lucide={Repeat} title="Section" variant={variant} />,
            );
            expect(screen.getByText('Section')).toBeInTheDocument();
            return {bar: screen.getByTestId('section-header'), unmount};
        };

        it('renders the default section as a card bar with a keyline', () => {
            const {bar} = renderVariant('primary');
            expect(bar).toHaveStyle({backgroundColor: 'var(--dd-surface-container)'});
            expect(bar).toHaveStyle({borderBottomWidth: '1px', borderBottomStyle: 'solid'});
            expect(bar.style.borderBottomColor).toBe('var(--mantine-color-default-border)');
        });

        it('keeps pickup map-blue and delivery green, independent of the tenant brand', () => {
            const {bar: pickup, unmount} = renderVariant('pickup');
            expect(pickup).toHaveStyle({backgroundColor: '#2a4eff'});
            // The coloured fills separate themselves — no keyline.
            expect(pickup.style.borderBottomStyle).toBe('');
            unmount();

            expect(renderVariant('delivery').bar).toHaveStyle({backgroundColor: '#13b964'});
        });

        it('exposes the fills so a caller can match a section to its header', () => {
            expect(sectionHeaderColors.pickup).toEqual({bg: '#2a4eff', fg: '#ffffff'});
            expect(sectionHeaderColors.delivery).toEqual({bg: '#13b964', fg: '#ffffff'});
        });
    });
});
