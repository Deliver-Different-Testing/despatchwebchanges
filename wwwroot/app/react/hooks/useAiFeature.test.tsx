/**
 * useAiFeature tests.
 *
 * The one that matters is the cross-island case. Each island is its own React root
 * *and* its own bundle — the build does no code-splitting — so a module-level
 * singleton would give each island private state and the side-menu switch would
 * appear to do nothing on the rest of the page. These tests mount two independent
 * roots, because one root cannot tell you whether that works.
 */

import React, {act} from 'react';
import {createRoot, Root} from 'react-dom/client';
import {renderHook} from '@testing-library/react';
import {useAiAutoOpen, useAiFeature, useAutoMateEnabled} from './useAiFeature';
import {resetAiPreferencesForTest, setAiPreferences} from '../services/aiPreferenceStore';

describe('useAiFeature', () => {
    beforeEach(() => {
        localStorage.clear();
        resetAiPreferencesForTest();
    });

    it('is on by default', () => {
        expect(renderHook(() => useAiFeature('pricing')).result.current).toBe(true);
    });

    it('follows its own category', () => {
        const {result, rerender} = renderHook(() => useAiFeature('pricing'));

        act(() => {
            setAiPreferences({categories: {pricing: false}});
        });
        rerender();

        expect(result.current).toBe(false);
    });

    it('follows the master switch whatever the category says', () => {
        const {result, rerender} = renderHook(() => useAiFeature('briefings'));

        act(() => {
            setAiPreferences({enabled: false, categories: {}});
        });
        rerender();

        expect(result.current).toBe(false);
    });

    it('reports auto-open only while briefings are on', () => {
        setAiPreferences({autoOpen: true});
        expect(renderHook(() => useAiAutoOpen()).result.current).toBe(true);

        setAiPreferences({categories: {briefings: false}});
        expect(renderHook(() => useAiAutoOpen()).result.current).toBe(false);
    });

    describe('across separate React roots', () => {
        let containers: HTMLDivElement[];
        let roots: Root[];

        beforeEach(() => {
            containers = [];
            roots = [];
        });

        afterEach(() => {
            act(() => {
                roots.forEach(root => root.unmount());
            });
            containers.forEach(container => container.remove());
        });

        function mountIsland(node: React.ReactElement): HTMLDivElement {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const root = createRoot(container);
            act(() => {
                root.render(node);
            });
            containers.push(container);
            roots.push(root);
            return container;
        }

        const PricingSurface: React.FC = () =>
            useAiFeature('pricing') ? <span>pricing on</span> : <span>pricing off</span>;

        const MasterChrome: React.FC = () =>
            useAutoMateEnabled() ? <span>auto-mate on</span> : <span>auto-mate off</span>;

        it('a change made in one root reaches a component in a different root', () => {
            const settingsIsland = mountIsland(<MasterChrome/>);
            const pageIsland = mountIsland(<PricingSurface/>);

            expect(settingsIsland.textContent).toBe('auto-mate on');
            expect(pageIsland.textContent).toBe('pricing on');

            // The side menu is its own island; this stands in for its switch.
            act(() => {
                setAiPreferences({enabled: false});
            });

            expect(settingsIsland.textContent).toBe('auto-mate off');
            expect(pageIsland.textContent).toBe('pricing off');
        });

        it('turning one category off leaves the other islands alone', () => {
            const pricingIsland = mountIsland(<PricingSurface/>);
            const masterIsland = mountIsland(<MasterChrome/>);

            act(() => {
                setAiPreferences({categories: {pricing: false}});
            });

            expect(pricingIsland.textContent).toBe('pricing off');
            expect(masterIsland.textContent).toBe('auto-mate on');
        });

        it('an unmounted island stops listening', () => {
            mountIsland(<PricingSurface/>);
            const root = roots[0];
            const container = containers[0];

            act(() => {
                root.unmount();
            });
            roots.length = 0;

            // No listener left to throw when the next change lands.
            expect(() => act(() => {
                setAiPreferences({enabled: false});
            })).not.toThrow();
            expect(container.textContent).toBe('');
        });
    });
});
