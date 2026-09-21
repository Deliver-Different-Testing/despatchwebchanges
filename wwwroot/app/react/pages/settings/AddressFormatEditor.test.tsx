import React from 'react';
import {fireEvent, screen, within} from '@testing-library/react';
import {AddressFormatEditor, AddressFormatEditorProps} from './AddressFormatEditor';
import {renderWithMantine} from '../../__testUtils__';
import {setupUser} from '../../__testUtils__/setupUser';
import type {AddressLineFormat} from '../../interfaces/address';

const userEvent = setupUser();

function renderEditor(value: AddressLineFormat, onChange = jest.fn()) {
    renderWithMantine(<AddressFormatEditor value={value} onChange={onChange} />);
    return onChange;
}

function radioFor(fieldLabel: string, lineLabel: 'Off' | 'Line 1' | 'Line 2') {
    return within(screen.getByRole('radiogroup', {name: `${fieldLabel} line`})).getByRole('radio', {name: lineLabel});
}

describe('AddressFormatEditor', () => {
    it('lists every configurable field across the three zones', () => {
        renderEditor({line1: ['postcode', 'streetName'], line2: []});

        expect(screen.getByText('Not shown')).toBeInTheDocument();
        expect(screen.getAllByRole('radiogroup')).toHaveLength(8);
    });

    it('reflects which zone each field is currently in', () => {
        renderEditor({line1: ['streetName'], line2: ['postcode']});

        expect(radioFor('Street Name', 'Line 1')).toBeChecked();
        expect(radioFor('Postcode', 'Line 2')).toBeChecked();
        expect(radioFor('Country', 'Off')).toBeChecked();
    });

    it('moves a field from off to line 1 when selected', async () => {
        const onChange = renderEditor({line1: ['streetName'], line2: []});

        await userEvent.click(radioFor('Country', 'Line 1'));

        expect(onChange).toHaveBeenCalledWith({line1: ['streetName', 'country'], line2: []});
    });

    it('moves a field from line 1 to line 2', async () => {
        const onChange = renderEditor({line1: ['streetName', 'postcode'], line2: []});

        await userEvent.click(radioFor('Postcode', 'Line 2'));

        expect(onChange).toHaveBeenCalledWith({line1: ['streetName'], line2: ['postcode']});
    });

    it('turns a field off, closing the gap in its line', async () => {
        const onChange = renderEditor({line1: ['streetName', 'postcode', 'country'], line2: []});

        await userEvent.click(radioFor('Postcode', 'Off'));

        expect(onChange).toHaveBeenCalledWith({line1: ['streetName', 'country'], line2: []});
    });

    it('reorders fields within line 1 with the arrow keys', () => {
        const onChange = renderEditor({line1: ['streetNumber', 'streetName', 'postcode'], line2: []});

        fireEvent.keyDown(screen.getByRole('button', {name: /Reorder Street Name/}), {key: 'ArrowUp'});

        expect(onChange).toHaveBeenCalledWith({line1: ['streetName', 'streetNumber', 'postcode'], line2: []});
    });

    it('does not reorder past the ends of a line', () => {
        const onChange = renderEditor({line1: ['streetNumber', 'streetName'], line2: []});

        fireEvent.keyDown(screen.getByRole('button', {name: /Reorder Street Number/}), {key: 'ArrowUp'});

        expect(onChange).not.toHaveBeenCalled();
    });

    it('does not offer a drag handle for not-shown fields', () => {
        renderEditor({line1: ['streetName'], line2: []});

        expect(screen.queryByRole('button', {name: /Reorder Country/})).not.toBeInTheDocument();
    });
});
