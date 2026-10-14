/** @jest-environment node */
import {defaultCourierDisplayMode, formatCourierDisplayLabel} from './courierDisplayMode';

describe('defaultCourierDisplayMode', () => {
    it('defaults US tenants to off', () => {
        expect(defaultCourierDisplayMode(true)).toBe('off');
    });

    it('defaults non-US (NZ) tenants to courier number', () => {
        expect(defaultCourierDisplayMode(false)).toBe('number');
    });
});

describe('formatCourierDisplayLabel', () => {
    it('returns undefined when off, regardless of what is available', () => {
        expect(formatCourierDisplayLabel('off', 'Jane Smith', '007')).toBeUndefined();
    });

    it('shows only the name in name mode', () => {
        expect(formatCourierDisplayLabel('name', 'Jane Smith', '007')).toBe('Jane Smith');
    });

    it('shows only the number in number mode', () => {
        expect(formatCourierDisplayLabel('number', 'Jane Smith', '007')).toBe('007');
    });

    it('shows both in both mode', () => {
        expect(formatCourierDisplayLabel('both', 'Jane Smith', '007')).toBe('Jane Smith · 007');
    });

    it('falls back to name when number mode is requested but no number is available', () => {
        expect(formatCourierDisplayLabel('number', 'Jane Smith', undefined)).toBe('Jane Smith');
    });

    it('falls back to number when name mode is requested but no name is available', () => {
        expect(formatCourierDisplayLabel('name', undefined, '007')).toBe('007');
    });

    it('returns undefined when nothing is available at all', () => {
        expect(formatCourierDisplayLabel('both', undefined, undefined)).toBeUndefined();
    });

    it('drops a missing number from both mode rather than showing a blank segment', () => {
        expect(formatCourierDisplayLabel('both', 'Jane Smith', undefined)).toBe('Jane Smith');
    });
});
