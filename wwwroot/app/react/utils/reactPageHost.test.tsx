/**
 * reactPageHost tests
 *
 * The AngularJS routes mount React pages by id, and every page module used to carry its
 * own copy of the same mount: swap roots when the container id changes, fall back to a
 * container it makes itself when the route has not rendered one yet, and keep the root
 * across re-mounts into the same element.
 */

import React from 'react';
import {act} from '@testing-library/react';
import {createPageHost} from './reactPageHost';

describe('createPageHost', () => {
    let host: ReturnType<typeof createPageHost<{label: string}>>;

    beforeEach(() => {
        document.body.innerHTML = '';
        host = createPageHost<{label: string}>({
            logName: 'ProbePage',
            render: config => <div data-testid="page">{config.label}</div>,
        });
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        act(() => host.unmount());
        jest.restoreAllMocks();
    });

    it('renders into an existing container', () => {
        const container = document.createElement('div');
        container.id = 'probe-page';
        document.body.appendChild(container);

        act(() => host.mount('probe-page', {label: 'Hello'}));

        expect(container).toHaveTextContent('Hello');
    });

    it('creates a fallback container when the route has not rendered one', () => {
        act(() => host.mount('missing-page', {label: 'Hello'}));

        const created = document.getElementById('missing-page');
        expect(created).toBeInTheDocument();
        expect(created).toHaveTextContent('Hello');
        expect(console.error).toHaveBeenCalledWith('[ProbePage] Container not found:', 'missing-page');
    });

    it('keeps the same root when re-mounting into the same container', () => {
        act(() => host.mount('probe-page', {label: 'First'}));
        const container = document.getElementById('probe-page');

        act(() => host.mount('probe-page', {label: 'Second'}));

        expect(document.getElementById('probe-page')).toBe(container);
        expect(container).toHaveTextContent('Second');
    });

    it('unmounts the previous page when the container id changes', () => {
        act(() => host.mount('first-page', {label: 'First'}));
        act(() => host.mount('second-page', {label: 'Second'}));

        expect(document.getElementById('first-page')).toBeEmptyDOMElement();
        expect(document.getElementById('second-page')).toHaveTextContent('Second');
    });

    it('empties the container on unmount and can mount again afterwards', () => {
        act(() => host.mount('probe-page', {label: 'Hello'}));

        act(() => host.unmount());
        expect(document.getElementById('probe-page')).toBeEmptyDOMElement();

        act(() => host.mount('probe-page', {label: 'Again'}));
        expect(document.getElementById('probe-page')).toHaveTextContent('Again');
    });

    it('takes the container out of the DOM on unmount when the page owns its element', () => {
        const owning = createPageHost<{label: string}>({
            logName: 'OwningPage',
            render: config => <div>{config.label}</div>,
            removeContainerOnUnmount: true,
        });

        act(() => owning.mount('owned-page', {label: 'Hello'}));
        act(() => owning.unmount());

        expect(document.getElementById('owned-page')).not.toBeInTheDocument();
    });

    it('re-renders into the existing root with a new config', () => {
        act(() => host.mount('probe-page', {label: 'First'}));

        act(() => host.rerender({label: 'Second'}));

        expect(document.getElementById('probe-page')).toHaveTextContent('Second');
    });

    it('ignores a re-render when nothing is mounted', () => {
        expect(() => act(() => host.rerender({label: 'Nowhere'}))).not.toThrow();
    });
});
