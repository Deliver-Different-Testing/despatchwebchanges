import {describe, expect, it} from 'vitest';
import {errorMessageOf} from './errorMessage';

describe('errorMessageOf', () => {
    it('reads the message of an Error or a plain ApiError', () => {
        expect(errorMessageOf(new Error('Job is locked'), 'fallback')).toBe('Job is locked');
        expect(errorMessageOf({status: 409, statusText: 'Conflict', message: 'Job is locked'}, 'fallback'))
            .toBe('Job is locked');
    });

    it.each([
        ['no message', {status: 0}],
        ['an empty message', {message: '  '}],
        ['an HTML error page', {message: '<html><body>502 Bad Gateway</body></html>'}],
        ["axios's generic status text", {message: 'Request failed with status code 500'}],
        ['a non-object', 'boom'],
        ['a runtime TypeError', new TypeError("Cannot read properties of undefined (reading 'id')")],
        ['a failed chunk import', new TypeError('Failed to fetch dynamically imported module: /assets/x.js')],
    ])('falls back for %s', (_label, error) => {
        expect(errorMessageOf(error, 'fallback')).toBe('fallback');
    });
});
