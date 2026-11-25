import React from 'react';
import {screen, within} from '@testing-library/react';
import {ItemLinesSection} from './ItemLinesSection';
import {createMockPallet} from '../__testUtils__/mockJob';
import {renderWithMantine as renderWithTheme} from '../../../../test/utils';

const firstCellOf = (text: string) => screen.getByText(text).closest('tr')!.querySelector('td')!;

describe('ItemLinesSection', () => {
    it('renders nothing when there are no lines', () => {
        // `MantineProvider` injects a <style> element, so assert the table is absent instead.
        const {unmount} = renderWithTheme(<ItemLinesSection lines={[]} isUsCustomer={false} />);
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        unmount();

        renderWithTheme(<ItemLinesSection lines={null as any} isUsCustomer={false} />);
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('names each line for what it is instead of calling everything a pallet (#955)', () => {
        renderWithTheme(<ItemLinesSection lines={[
            createMockPallet({itemId: 1, quantity: 2, notes: 'Banana box', length: 53, depth: 39, height: 24}),
            createMockPallet({itemId: 2, quantity: 1, notes: 'Pallet'}),
        ]} isUsCustomer={false} />);

        expect(screen.getByText('Items')).toBeInTheDocument();
        expect(screen.queryByText(/pallet information/i)).not.toBeInTheDocument();
        expect(screen.getByText('2 lines · 3 units')).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: 'Item'})).toBeInTheDocument();
        expect(firstCellOf('53 x 39 x 24')).toHaveTextContent('Banana box');
    });

    it('shows a dash for an unnamed line', () => {
        renderWithTheme(<ItemLinesSection lines={[createMockPallet({notes: ''})]} isUsCustomer={false} />);

        expect(firstCellOf('120 x 80 x 100')).toHaveTextContent('—');
    });

    it('counts a single line and unit in the singular', () => {
        renderWithTheme(<ItemLinesSection lines={[createMockPallet({quantity: 1})]} isUsCustomer={false} />);

        expect(screen.getByText('1 line · 1 unit')).toBeInTheDocument();
    });

    it('uses metric units for non-US customers', () => {
        renderWithTheme(<ItemLinesSection lines={[createMockPallet()]} isUsCustomer={false} />);

        expect(screen.getByText(/Weight \(kg\)/)).toBeInTheDocument();
        expect(screen.getByText(/Dimensions \(cm\)/)).toBeInTheDocument();
    });

    it('uses imperial units for US customers', () => {
        renderWithTheme(<ItemLinesSection lines={[createMockPallet()]} isUsCustomer={true} />);

        expect(screen.getByText(/Weight \(lbs\)/)).toBeInTheDocument();
        expect(screen.getByText(/Dimensions \(in\)/)).toBeInTheDocument();
    });

    it('calculates totals correctly', () => {
        renderWithTheme(<ItemLinesSection lines={[
            createMockPallet({quantity: 2, weight: 25, length: 100, depth: 80, height: 50}),
            createMockPallet({id: 2, quantity: 3, weight: 10, length: 60, depth: 40, height: 30}),
        ]} isUsCustomer={false} />);

        const summary = screen.getByText('Total').closest('tr')!;
        expect(within(summary).getByText('5')).toBeInTheDocument();
        expect(within(summary).getByText('80.0')).toBeInTheDocument();
    });

    it('shows PU and DO chips', () => {
        renderWithTheme(<ItemLinesSection lines={[createMockPallet({pu: true, do: true})]} isUsCustomer={false} />);

        expect(screen.getByText('PU')).toBeInTheDocument();
        expect(screen.getByText('DO')).toBeInTheDocument();
    });

    it('renders the current lines when they change', () => {
        const {rerender} = renderWithTheme(<ItemLinesSection lines={[
            createMockPallet({itemId: 1, quantity: 2, notes: 'Carton A1'}),
            createMockPallet({itemId: 2, quantity: 3, notes: 'Carton A2'}),
            createMockPallet({itemId: 3, quantity: 1, notes: 'Carton A3'}),
        ]} isUsCustomer={false} />);

        expect(document.querySelector('tbody')!.querySelectorAll('tr')).toHaveLength(4); // 3 lines + summary

        // `renderWithMantine` supplies the provider as RTL's `wrapper`, so the rerender must NOT re-wrap it.
        rerender(<ItemLinesSection lines={[createMockPallet({itemId: 10, quantity: 5, notes: 'Carton B1'})]}
                                   isUsCustomer={false} />);

        expect(document.querySelector('tbody')!.querySelectorAll('tr')).toHaveLength(2);
        expect(screen.getByText('Carton B1')).toBeInTheDocument();
        expect(screen.queryByText('Carton A1')).not.toBeInTheDocument();
    });

    it('greys flagged lines, badges them and leaves them out of the totals', () => {
        renderWithTheme(<ItemLinesSection lines={[
            createMockPallet({itemId: 1, quantity: 2, weight: 10, notes: 'Active'}),
            createMockPallet({itemId: 2, quantity: 1, weight: 7, notes: 'Short', itemStatus: 1}),
            createMockPallet({itemId: 3, quantity: 1, weight: 9, notes: 'Pulled', itemStatus: 2}),
        ]} isUsCustomer={false} />);

        expect(screen.getByText('Not picked up')).toBeInTheDocument();
        expect(screen.getByText('Not for delivery')).toBeInTheDocument();
        expect(screen.getByText('Short').closest('tr')).toHaveStyle({opacity: '0.5'});
        const summary = screen.getByText('Total').closest('tr')!;
        expect(summary).toHaveTextContent('2');
        expect(summary).toHaveTextContent('20.0');
        expect(screen.getByText('1 line · 2 units · 2 flagged')).toBeInTheDocument();
    });

    it('keys lines that share a job id by their item id', () => {
        renderWithTheme(<ItemLinesSection lines={[
            createMockPallet({id: 100, itemId: 1, notes: 'First'}),
            createMockPallet({id: 100, itemId: 2, notes: 'Second'}),
            createMockPallet({id: 100, itemId: 3, notes: 'Third'}),
        ]} isUsCustomer={false} />);

        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
        expect(screen.getByText('Third')).toBeInTheDocument();
    });
});
