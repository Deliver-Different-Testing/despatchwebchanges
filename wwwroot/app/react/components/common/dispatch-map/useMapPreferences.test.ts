/** @jest-environment jest-environment-jsdom */
/**
 * useMapPreferences Hook Tests
 *
 * Tests for the map preferences hook with localStorage mocking.
 */

import {renderHook, act} from '@testing-library/react';
import {PREFERENCE_KEYS} from './DispatchMap.types';

jest.mock('../../../../contants', () => ({
    ContactID: 12345,
}));

import {useMapPreferences} from './useMapPreferences';

const mockContactId = 12345;

describe('useMapPreferences', () => {
    let mockLocalStorage: {[key: string]: string};

    beforeEach(() => {
        // Reset localStorage mock
        mockLocalStorage = {};

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
                setItem: jest.fn((key: string, value: string) => {
                    mockLocalStorage[key] = value;
                }),
                removeItem: jest.fn((key: string) => {
                    delete mockLocalStorage[key];
                }),
                clear: jest.fn(() => {
                    mockLocalStorage = {};
                }),
            },
            writable: true,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Initial State', () => {
        it('returns default control state when no preferences saved', () => {
            const {result} = renderHook(() => useMapPreferences());

            expect(result.current.controlState).toEqual({
                autoZoomEnabled: true,
                couriersOnlyEnabled: false,
                urgentArmyOnlyEnabled: false,
                couriersLargeViewEnabled: false,
            });
        });

        it('loads saved autoZoom preference from localStorage', () => {
            const key = `${PREFERENCE_KEYS.AUTO_ZOOM}-${mockContactId}`;
            mockLocalStorage[key] = JSON.stringify({display: false});

            const {result} = renderHook(() => useMapPreferences());

            expect(result.current.controlState.autoZoomEnabled).toBe(false);
        });

        it('loads saved couriersOnly preference from localStorage', () => {
            const key = `${PREFERENCE_KEYS.COURIERS_ONLY}-${mockContactId}`;
            mockLocalStorage[key] = JSON.stringify({display: true});

            const {result} = renderHook(() => useMapPreferences());

            expect(result.current.controlState.couriersOnlyEnabled).toBe(true);
        });

        it('loads saved urgentArmyOnly preference from localStorage', () => {
            const key = `${PREFERENCE_KEYS.URGENT_ARMY_ONLY}-${mockContactId}`;
            mockLocalStorage[key] = JSON.stringify({display: true});

            const {result} = renderHook(() => useMapPreferences());

            expect(result.current.controlState.urgentArmyOnlyEnabled).toBe(true);
        });

        it('loads saved couriersLargeView preference from localStorage', () => {
            const key = `${PREFERENCE_KEYS.COURIERS_LARGE_VIEW}-${mockContactId}`;
            mockLocalStorage[key] = JSON.stringify({display: true});

            const {result} = renderHook(() => useMapPreferences());

            expect(result.current.controlState.couriersLargeViewEnabled).toBe(true);
        });
    });

    describe('Toggle Functions', () => {
        it('toggleAutoZoom toggles the autoZoomEnabled state', () => {
            const {result} = renderHook(() => useMapPreferences());

            expect(result.current.controlState.autoZoomEnabled).toBe(true);

            act(() => {
                result.current.toggleAutoZoom();
            });

            expect(result.current.controlState.autoZoomEnabled).toBe(false);

            act(() => {
                result.current.toggleAutoZoom();
            });

            expect(result.current.controlState.autoZoomEnabled).toBe(true);
        });

        it('toggleAutoZoom saves preference to localStorage', () => {
            const {result} = renderHook(() => useMapPreferences());

            act(() => {
                result.current.toggleAutoZoom();
            });

            const key = `${PREFERENCE_KEYS.AUTO_ZOOM}-${mockContactId}`;
            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                key,
                JSON.stringify({display: false})
            );
        });

        it('toggleCouriersOnly toggles the couriersOnlyEnabled state', () => {
            const {result} = renderHook(() => useMapPreferences());

            expect(result.current.controlState.couriersOnlyEnabled).toBe(false);

            act(() => {
                result.current.toggleCouriersOnly();
            });

            expect(result.current.controlState.couriersOnlyEnabled).toBe(true);
        });

        it('toggleCouriersOnly does nothing when large view is enabled', () => {
            const key = `${PREFERENCE_KEYS.COURIERS_LARGE_VIEW}-${mockContactId}`;
            mockLocalStorage[key] = JSON.stringify({display: true});

            const {result} = renderHook(() => useMapPreferences());

            expect(result.current.controlState.couriersLargeViewEnabled).toBe(true);
            expect(result.current.controlState.couriersOnlyEnabled).toBe(false);

            act(() => {
                result.current.toggleCouriersOnly();
            });

            // Should remain false because large view is enabled
            expect(result.current.controlState.couriersOnlyEnabled).toBe(false);
        });

        it('toggleUrgentArmyOnly toggles the urgentArmyOnlyEnabled state', () => {
            const {result} = renderHook(() => useMapPreferences());

            expect(result.current.controlState.urgentArmyOnlyEnabled).toBe(false);

            act(() => {
                result.current.toggleUrgentArmyOnly();
            });

            expect(result.current.controlState.urgentArmyOnlyEnabled).toBe(true);
        });

        it('toggleUrgentArmyOnly does nothing when large view is enabled', () => {
            const key = `${PREFERENCE_KEYS.COURIERS_LARGE_VIEW}-${mockContactId}`;
            mockLocalStorage[key] = JSON.stringify({display: true});

            const {result} = renderHook(() => useMapPreferences());

            act(() => {
                result.current.toggleUrgentArmyOnly();
            });

            // Should remain false because large view is enabled
            expect(result.current.controlState.urgentArmyOnlyEnabled).toBe(false);
        });

        it('toggleCouriersLargeView toggles the couriersLargeViewEnabled state', () => {
            const {result} = renderHook(() => useMapPreferences());

            expect(result.current.controlState.couriersLargeViewEnabled).toBe(false);

            act(() => {
                result.current.toggleCouriersLargeView();
            });

            expect(result.current.controlState.couriersLargeViewEnabled).toBe(true);
        });

        it('toggleCouriersLargeView disables couriersOnly and urgentArmyOnly when enabled', () => {
            const {result} = renderHook(() => useMapPreferences());

            // First enable couriers only and urgent army
            act(() => {
                result.current.toggleCouriersOnly();
                result.current.toggleUrgentArmyOnly();
            });

            expect(result.current.controlState.couriersOnlyEnabled).toBe(true);
            expect(result.current.controlState.urgentArmyOnlyEnabled).toBe(true);

            // Now enable large view
            act(() => {
                result.current.toggleCouriersLargeView();
            });

            // Both should be disabled
            expect(result.current.controlState.couriersOnlyEnabled).toBe(false);
            expect(result.current.controlState.urgentArmyOnlyEnabled).toBe(false);
            expect(result.current.controlState.couriersLargeViewEnabled).toBe(true);
        });
    });

    describe('Set Functions', () => {
        it('setAutoZoom sets the autoZoomEnabled state directly', () => {
            const {result} = renderHook(() => useMapPreferences());

            act(() => {
                result.current.setAutoZoom(false);
            });

            expect(result.current.controlState.autoZoomEnabled).toBe(false);

            act(() => {
                result.current.setAutoZoom(true);
            });

            expect(result.current.controlState.autoZoomEnabled).toBe(true);
        });

        it('setCouriersOnly sets the couriersOnlyEnabled state directly', () => {
            const {result} = renderHook(() => useMapPreferences());

            act(() => {
                result.current.setCouriersOnly(true);
            });

            expect(result.current.controlState.couriersOnlyEnabled).toBe(true);
        });

        it('setUrgentArmyOnly sets the urgentArmyOnlyEnabled state directly', () => {
            const {result} = renderHook(() => useMapPreferences());

            act(() => {
                result.current.setUrgentArmyOnly(true);
            });

            expect(result.current.controlState.urgentArmyOnlyEnabled).toBe(true);
        });

        it('setCouriersLargeView sets the couriersLargeViewEnabled state directly', () => {
            const {result} = renderHook(() => useMapPreferences());

            act(() => {
                result.current.setCouriersLargeView(true);
            });

            expect(result.current.controlState.couriersLargeViewEnabled).toBe(true);
        });
    });

    describe('LocalStorage Error Handling', () => {
        it('handles localStorage.getItem errors gracefully', () => {
            jest.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
                throw new Error('Storage error');
            });
            jest.spyOn(console, 'error').mockImplementation(() => {});

            const {result} = renderHook(() => useMapPreferences());

            // Should return defaults when localStorage fails
            expect(result.current.controlState.autoZoomEnabled).toBe(true);
        });

        it('handles localStorage.setItem errors gracefully', () => {
            jest.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
                throw new Error('Storage full');
            });
            jest.spyOn(console, 'error').mockImplementation(() => {});

            const {result} = renderHook(() => useMapPreferences());

            // Should not throw when saving fails
            expect(() => {
                act(() => {
                    result.current.toggleAutoZoom();
                });
            }).not.toThrow();
        });

        it('handles invalid JSON in localStorage gracefully', () => {
            const key = `${PREFERENCE_KEYS.AUTO_ZOOM}-${mockContactId}`;
            mockLocalStorage[key] = 'invalid json';
            jest.spyOn(console, 'error').mockImplementation(() => {});

            const {result} = renderHook(() => useMapPreferences());

            // Should return default when JSON is invalid
            expect(result.current.controlState.autoZoomEnabled).toBe(true);
        });
    });
});
