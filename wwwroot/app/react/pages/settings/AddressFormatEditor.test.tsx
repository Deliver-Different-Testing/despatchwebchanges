import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {AddressFormatEditor, AddressFormatEditorProps} from './AddressFormatEditor';
import {renderWithMantine} from '../../__testUtils__';
import {setupUser} from '../../__testUtils__/setupUser';
import type {AddressFieldKey} from '../../interfaces/address';

const userEvent = setupUser();

function renderEditor(fields: AddressFieldKey[], onChange = jest.fn()) {
    renderWithMantine(<AddressFormatEditor fields={fields} onChange={onChange} />);
    return onChange;
}

describe('AddressFormatEditor', () => {
    it('lists every configurable field, included ones first in their saved order', () => {
        renderEditor(['postcode', 'streetName']);

        const rows = screen.getAllByRole('switch').map((el) => el.getAttribute('aria-label'));
        expect(rows.slice(0, 2)).toEqual(['Show Postcode', 'Show Street Name']);
        expect(rows).toHaveLength(8);
    });

    it('reflects which fields are currently included', () => {
        renderEditor(['streetName']);

        expect(screen.getByLabelText('Show Street Name')).toBeChecked();
        expect(screen.getByLabelText('Show Postcode')).not.toBeChecked();
    });

    it('adds a field to the end of the included list when switched on', async () => {
        const onChange = renderEditor(['streetName', 'postcode']);

        await userEvent.click(screen.getByLabelText('Show Country'));

        expect(onChange).toHaveBeenCalledWith(['streetName', 'postcode', 'country']);
    });

    it('removes a field, closing the gap in the included order', async () => {
        const onChange = renderEditor(['streetName', 'postcode', 'country']);

        await userEvent.click(screen.getByLabelText('Show Postcode'));

        expect(onChange).toHaveBeenCalledWith(['streetName', 'country']);
    });

    it('reorders included fields with the arrow keys', () => {
        const onChange = renderEditor(['streetNumber', 'streetName', 'postcode']);

        fireEvent.keyDown(screen.getByRole('button', {name: /Reorder Street Name/}), {key: 'ArrowUp'});

        expect(onChange).toHaveBeenCalledWith(['streetName', 'streetNumber', 'postcode']);
    });

    it('does not reorder past the ends of the list', () => {
        const onChange = renderEditor(['streetNumber', 'streetName']);

        fireEvent.keyDown(screen.getByRole('button', {name: /Reorder Street Number/}), {key: 'ArrowUp'});

        expect(onChange).not.toHaveBeenCalled();
    });
});
