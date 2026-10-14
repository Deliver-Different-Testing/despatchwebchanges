import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {DialogShell, DialogHeader, DialogFooter} from './index';
import {renderWithMantine} from '../../../../test/utils';

const mockUseGlassAllowed = jest.fn();
jest.mock('../../../../hooks/useGlassStrategy', () => ({useGlassAllowed: () => mockUseGlassAllowed()}));
jest.mock('./DialogGlass.module.css', () => ({__esModule: true, default: {bar: 'bar', header: 'header', footer: 'footer'}}));

function renderDialog() {
    return renderWithMantine(
        <DialogShell opened onClose={jest.fn()}>
            <DialogHeader icon={<span/>} title="Edit price" onClose={jest.fn()}/>
            <div>Body</div>
            <DialogFooter onCancel={jest.fn()} onConfirm={jest.fn()} confirmLabel="Save"/>
        </DialogShell>,
    );
}

describe('dialog glass chrome', () => {
    it('lets the body scroll under translucent header and footer bars when glass is allowed', () => {
        mockUseGlassAllowed.mockReturnValue(true);
        renderDialog();

        const header = screen.getByRole('button', {name: 'Close dialog'}).parentElement!;
        const footer = screen.getByRole('button', {name: 'Cancel'}).parentElement!;
        expect(header.parentElement).toHaveClass('bar', 'header');
        expect(footer.parentElement).toHaveClass('bar', 'footer');
        expect(header.style.backgroundColor).toBe('transparent');
        expect(footer.style.backgroundColor).toBe('transparent');

        const scroll = screen.getByRole('dialog').querySelector<HTMLElement>('[data-dialog-scroll]')!;
        expect(scroll.style.marginTop).toBe('0px');
        expect(scroll.style.paddingTop).toBe('0px');
        expect(scroll.style.marginBottom).toBe('0px');
    });

    it('keeps the opaque bars in normal flow when glass is off', () => {
        mockUseGlassAllowed.mockReturnValue(false);
        renderDialog();

        const header = screen.getByRole('button', {name: 'Close dialog'}).parentElement!;
        expect(header.parentElement).not.toHaveClass('bar');
        expect(header.style.backgroundColor).not.toBe('transparent');
        const scroll = screen.getByRole('dialog').querySelector<HTMLElement>('[data-dialog-scroll]')!;
        expect(scroll.style.marginTop).toBe('');
    });

    describe('glass only where content sits beneath the bar', () => {
        const scrollTo = (scroll: HTMLElement, metrics: {scrollTop: number; scrollHeight: number; clientHeight: number}) => {
            Object.entries(metrics).forEach(([key, value]) => Object.defineProperty(scroll, key, {value, configurable: true}));
            fireEvent.scroll(scroll);
        };

        it('keeps both bars solid while the body fits and sits at the top', () => {
            mockUseGlassAllowed.mockReturnValue(true);
            renderDialog();

            const dialog = screen.getByRole('dialog');
            expect(dialog.querySelector('.header')).not.toHaveAttribute('data-glass-active');
            expect(dialog.querySelector('.footer')).not.toHaveAttribute('data-glass-active');
        });

        it('turns the header to glass once scrolled, and the footer while more content lies below', () => {
            mockUseGlassAllowed.mockReturnValue(true);
            renderDialog();
            const dialog = screen.getByRole('dialog');
            const scroll = dialog.querySelector<HTMLElement>('[data-dialog-scroll]')!;

            scrollTo(scroll, {scrollTop: 0, scrollHeight: 600, clientHeight: 300});
            expect(dialog.querySelector('.header')).not.toHaveAttribute('data-glass-active');
            expect(dialog.querySelector('.footer')).toHaveAttribute('data-glass-active');

            scrollTo(scroll, {scrollTop: 120, scrollHeight: 600, clientHeight: 300});
            expect(dialog.querySelector('.header')).toHaveAttribute('data-glass-active');
            expect(dialog.querySelector('.footer')).toHaveAttribute('data-glass-active');

            scrollTo(scroll, {scrollTop: 300, scrollHeight: 600, clientHeight: 300});
            expect(dialog.querySelector('.footer')).not.toHaveAttribute('data-glass-active');
        });
    });
});
