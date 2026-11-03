import {formatMinutes} from './formatMinutes';

describe('formatMinutes', () => {
    it.each([
        [0, '0m'],
        [45, '45m'],
        [60, '1h 0m'],
        [450, '7h 30m'],
        [59.6, '1h 0m'],
        [119.5, '2h 0m'],
        [-5, '0m'],
    ])('formats %s as %s', (input, expected) => {
        expect(formatMinutes(input)).toBe(expected);
    });
});
