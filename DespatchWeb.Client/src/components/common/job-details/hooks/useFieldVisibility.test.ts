/**
 * useFieldVisibility Hook Tests
 */

import {renderHook, act} from '@testing-library/react';
import {useFieldVisibility} from './useFieldVisibility';

const CONTACT_ID = 42;
const STORAGE_KEY = `jobDetail_fieldVisibility_${CONTACT_ID}`;

describe('useFieldVisibility', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns default visibility when nothing in storage', () => {
        const {result} = renderHook(() => useFieldVisibility(CONTACT_ID));

        expect(result.current.isFieldVisible('speedName')).toBe(true);
        expect(result.current.isFieldVisible('refA')).toBe(true);
        expect(result.current.isEditMode).toBe(false);
    });

    it('loads saved visibility from localStorage', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({speedName: false}));

        const {result} = renderHook(() => useFieldVisibility(CONTACT_ID));
        expect(result.current.isFieldVisible('speedName')).toBe(false);
    });

    it('toggleField flips visibility in both directions and persists to storage', () => {
        const {result} = renderHook(() => useFieldVisibility(CONTACT_ID));

        // Toggle off
        act(() => {
            result.current.toggleField('speedName');
        });
        expect(result.current.isFieldVisible('speedName')).toBe(false);
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        expect(stored.speedName).toBe(false);

        // Toggle back on
        act(() => {
            result.current.toggleField('speedName');
        });
        expect(result.current.isFieldVisible('speedName')).toBe(true);
    });

    it('resetToDefaults restores default visibility', () => {
        const {result} = renderHook(() => useFieldVisibility(CONTACT_ID));

        act(() => {
            result.current.toggleField('speedName');
            result.current.toggleField('refA');
        });

        act(() => {
            result.current.resetToDefaults();
        });

        expect(result.current.isFieldVisible('speedName')).toBe(true);
        expect(result.current.isFieldVisible('refA')).toBe(true);
    });

    it('toggleEditMode toggles edit mode on/off', () => {
        const {result} = renderHook(() => useFieldVisibility(CONTACT_ID));

        expect(result.current.isEditMode).toBe(false);

        act(() => {
            result.current.toggleEditMode();
        });
        expect(result.current.isEditMode).toBe(true);

        act(() => {
            result.current.toggleEditMode();
        });
        expect(result.current.isEditMode).toBe(false);
    });

    it('unknown fields default to visible', () => {
        const {result} = renderHook(() => useFieldVisibility(CONTACT_ID));
        expect(result.current.isFieldVisible('nonExistentField')).toBe(true);
    });

    it('handles corrupt localStorage gracefully', () => {
        localStorage.setItem(STORAGE_KEY, 'not valid json');

        const {result} = renderHook(() => useFieldVisibility(CONTACT_ID));
        expect(result.current.isFieldVisible('speedName')).toBe(true);
    });
});
