import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {BoxShell, BoxShellProps} from './BoxShell';
import {setLiquidGlassEnabled} from '../../../hooks/useLiquidGlassPreference';
import {ILayout} from '../../../../interfaces/layout.interfaces';

jest.mock('../../../hooks/glassSupport', () => ({
    ...jest.requireActual('../../../hooks/glassSupport'),
    isLiquidGlassSupported: () => true,
}));


const layout: ILayout = {
    name: 'Default',
    layout: {
        columns: [
            {id: 'col1', width: '100%', boxes: [{name: 'jobList', title: 'Live Job Data', visible: true}]},
        ],
    },
};

const baseProps: BoxShellProps = {
    layout,
    layoutVersion: 0,
    boxes: {jobList: {name: 'jobList', title: 'Live Job Data', visible: true}},
    renderBoxContent: (name) => <div>{`content-${name}`}</div>,
    onRefreshBox: jest.fn(),
};

const renderShell = (props: Partial<BoxShellProps> = {}) =>
    render(
        <MantineTestProvider>
            <BoxShell {...baseProps} {...props} />
        </MantineTestProvider>,
    );

const twoBoxLayout = (name: string): ILayout => ({
    name,
    layout: {
        columns: [{
            id: 'col1',
            width: '100%',
            boxes: [
                {name: 'jobList', title: 'Live Job Data', visible: true},
                {name: 'map', title: 'Map', visible: false},
            ],
        }],
    },
});
const twoBoxBoxes = {
    jobList: {name: 'jobList', title: 'Live Job Data', visible: true},
    map: {name: 'map', title: 'Map', visible: false},
};

describe('BoxShell layout affordances', () => {
    it('offers reorder on a custom layout without needing Edit columns mode', () => {
        renderShell({layout: {...layout, name: 'My Layout'}, onMoveBox: jest.fn()});

        expect(screen.getByRole('button', {name: /Reorder/})).toBeInTheDocument();
        expect(screen.getByText('Live Job Data')).toBeInTheDocument();
    });

    it('offers no reorder or resize affordances on the Default layout', () => {
        const {container} = renderShell({
            layout: {
                ...layout,
                name: 'Default',
                layout: {
                    columns: [
                        {id: 'col1', width: '50%', boxes: [{name: 'jobList', title: 'Live Job Data', visible: true}]},
                        {id: 'col2', width: '50%', boxes: [{name: 'map', title: 'Map', visible: true}]},
                    ],
                },
            },
            boxes: {
                jobList: {name: 'jobList', title: 'Live Job Data', visible: true},
                map: {name: 'map', title: 'Map', visible: true},
            },
            onMoveBox: jest.fn(),
            isDefaultLayout: true,
        });

        expect(screen.queryByRole('button', {name: /Reorder/})).not.toBeInTheDocument();
        expect(container.querySelectorAll('[data-panel-resize-handle]')).toHaveLength(0);
    });

    it('offers a hide button alongside reorder on a custom layout', () => {
        const onHideBox = jest.fn();
        renderShell({onMoveBox: jest.fn(), onHideBox});

        fireEvent.click(screen.getByRole('button', {name: /Hide/}));

        expect(onHideBox).toHaveBeenCalledWith('jobList');
    });

    it('offers no hide button on the Default layout', () => {
        renderShell({onMoveBox: jest.fn(), onHideBox: jest.fn(), isDefaultLayout: true});

        expect(screen.queryByRole('button', {name: /Hide/})).not.toBeInTheDocument();
    });

    it('hides the hide button when the user has turned it off, without affecting reorder', () => {
        renderShell({onMoveBox: jest.fn(), onHideBox: jest.fn(), hideButtonEnabled: false});

        expect(screen.queryByRole('button', {name: /Hide/})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Reorder/})).toBeInTheDocument();
    });

    it('has no collapse control', () => {
        renderShell({layout: {...layout, name: 'My Layout'}, onMoveBox: jest.fn()});

        expect(screen.queryByRole('button', {name: /Collapse|Expand/})).not.toBeInTheDocument();
    });

    it('hides the columns bar until "Edit columns" mode is on', () => {
        renderShell({layout: {...layout, name: 'My Layout'}, onMoveBox: jest.fn()});

        expect(screen.queryByText('Editing columns')).not.toBeInTheDocument();
        expect(screen.queryByRole('group', {name: /number of columns/i})).not.toBeInTheDocument();
    });

    /*
     * `isDefaultLayout` must be threaded through: without it both cases exercise
     * the user-layout branch, and the Default branch — which deliberately ignores
     * a stored visibility record — goes uncovered.
     */
    it.each(['Default', 'My Layout'])('honours hidden panels on the %s layout', (name) => {
        renderShell({
            layout: twoBoxLayout(name),
            boxes: twoBoxBoxes,
            isDefaultLayout: name === 'Default',
        });

        expect(screen.getByText('Live Job Data')).toBeInTheDocument();
        expect(screen.queryByText('Map')).not.toBeInTheDocument();
    });

    /*
     * A panel the definitions ship as `visible: false` stays off on the read-only
     * Default layout too. Only an *absent* visible flag falls back to shown there,
     * so a stored record cannot turn a panel off for everyone on Default.
     */
    it('shows a panel with no visible flag on the Default layout', () => {
        renderShell({
            layout: {
                name: 'Default',
                layout: {
                    columns: [{
                        id: 'col1',
                        width: '100%',
                        boxes: [{name: 'jobList'}, {name: 'map'}],
                    }],
                },
            },
            boxes: {
                jobList: {name: 'jobList', title: 'Live Job Data'},
                map: {name: 'map', title: 'Map'},
            },
            isDefaultLayout: true,
        });

        expect(screen.getByText('Live Job Data')).toBeInTheDocument();
        expect(screen.getByText('Map')).toBeInTheDocument();
    });
});

describe('BoxShell columns bar', () => {
    const multiCol = (name: string, count: number): ILayout => ({
        name,
        layout: {
            columns: Array.from({length: count}, (_, i) => ({
                id: `col${i + 1}`,
                width: `${100 / count}%`,
                boxes: i === 0 ? [{name: 'jobList', title: 'Live Job Data', visible: true}] : [],
            })),
        },
    });

    const editing = (props: Partial<BoxShellProps> = {}) => renderShell({
        columnEditMode: true,
        layout: multiCol('My Layout', 2),
        onAddColumn: jest.fn(),
        onRemoveColumn: jest.fn(),
        ...props,
    });

    it('shows the stepper on a custom layout', () => {
        editing({layout: multiCol('My Layout', 2)});

        expect(screen.getByText('Editing columns')).toBeInTheDocument();
        expect(screen.getByRole('group', {name: /number of columns/i})).toHaveTextContent('2');
    });

    it('adds and removes columns', () => {
        const onAddColumn = jest.fn();
        const onRemoveColumn = jest.fn();
        editing({onAddColumn, onRemoveColumn});

        fireEvent.click(screen.getByRole('button', {name: /add column/i}));
        fireEvent.click(screen.getByRole('button', {name: /remove column/i}));

        expect(onAddColumn).toHaveBeenCalledTimes(1);
        expect(onRemoveColumn).toHaveBeenCalledTimes(1);
    });

    it('stops at one column and at the six-column maximum', () => {
        const {unmount} = editing({layout: multiCol('My Layout', 1)});
        expect(screen.getByRole('button', {name: /remove column/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /add column/i})).toBeEnabled();
        unmount();

        editing({layout: multiCol('My Layout', 6)});
        expect(screen.getByRole('button', {name: /add column/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /remove column/i})).toBeEnabled();
    });

    it('leaves the mode from Done', () => {
        const onExitColumnEditMode = jest.fn();
        editing({onExitColumnEditMode});

        fireEvent.click(screen.getByRole('button', {name: /^done$/i}));
        expect(onExitColumnEditMode).toHaveBeenCalledTimes(1);
    });
});

describe('BoxShell resize persistence', () => {
    const resized = (name: string, first: string, second: string): ILayout => ({
        name,
        layout: {
            columns: [
                {id: 'col1', width: first, boxes: [{name: 'jobList', title: 'Live Job Data', visible: true}]},
                {id: 'col2', width: second, boxes: [{name: 'map', title: 'Map', visible: true}]},
            ],
        },
    });
    const multiCol = (name: string): ILayout => resized(name, '50%', '50%');
    const multiColBoxes = {
        jobList: {name: 'jobList', title: 'Live Job Data', visible: true},
        map: {name: 'map', title: 'Map', visible: true},
    };

    it('renders a resize gutter between columns on a custom layout without needing Edit columns mode', () => {
        const {container} = renderShell({layout: multiCol('My Layout'), boxes: multiColBoxes});

        expect(container.querySelectorAll('[data-panel-resize-handle]')).toHaveLength(1);
    });

    it('renders no resize gutter on the Default layout', () => {
        const {container} = renderShell({
            layout: multiCol('Default'),
            boxes: multiColBoxes,
            isDefaultLayout: true,
        });

        expect(container.querySelectorAll('[data-panel-resize-handle]')).toHaveLength(0);
    });

    it('ignores the layout emitted on mount so a fresh load persists nothing', () => {
        const onColumnSizes = jest.fn();
        renderShell({layout: multiCol('Default'), boxes: multiColBoxes, onColumnSizes});

        expect(onColumnSizes).not.toHaveBeenCalled();
    });

    it('persists a genuine resize once the group has settled', () => {
        const onColumnSizes = jest.fn();
        const {rerender} = renderShell({
            layout: multiCol('Default'),
            boxes: multiColBoxes,
            onColumnSizes,
        });

        // A drag re-lays-out the same (un-remounted) group with new sizes.
        rerender(
            <MantineTestProvider>
                <BoxShell
                    {...baseProps}
                    layout={resized('Default', '70%', '30%')}
                    boxes={multiColBoxes}
                    onColumnSizes={onColumnSizes}
                />
            </MantineTestProvider>,
        );

        expect(onColumnSizes).toHaveBeenCalledTimes(1);
        expect(onColumnSizes).toHaveBeenCalledWith([70, 30]);
    });

});

describe('BoxShell box card chrome', () => {
    /*
     * A box card is a card: bordered, rounded, and raised above the page. It has
     * to sit on the container surface, not the page one. When it took the page
     * token, any panel that did not repaint its own background — the empty-state
     * branches especially — rendered on grey while its neighbours were white.
     */
    it('paints each box card on the card surface rather than the page background', () => {
        renderShell();

        expect(screen.getByTestId('job-search-box-card').style.backgroundColor)
            .toBe('var(--dd-surface-container)');
    });

    describe('sticky header', () => {
        afterEach(() => setLiquidGlassEnabled(false));

        it('overlays the header on the scroller so body content can scroll beneath it', () => {
            renderShell();

            const card = screen.getByTestId('job-search-box-card');
            expect(card.firstElementChild).toBe(screen.getByTestId('job-search-box-header'));
            expect(screen.getByTestId('job-search-box-scroller')).toHaveTextContent('content-jobList');
        });

        it('stays a solid header even with Liquid Glass on, because it sits over dense job rows', () => {
            setLiquidGlassEnabled(true);
            renderShell();
            const header = screen.getByTestId('job-search-box-header');

            const scroller = screen.getByTestId('job-search-box-scroller');
            Object.defineProperty(scroller, 'scrollTop', {value: 12, configurable: true});
            fireEvent.scroll(scroller);

            expect(header).not.toHaveAttribute('data-glass');
            expect(header).not.toHaveAttribute('data-scrolled');
        });
    });
});

describe('BoxShell pointer reorder', () => {
    it('tags cards and columns so a drag can resolve its drop target, and moves on drop', () => {
        const onMoveBox = jest.fn();
        const {container} = renderShell({
            layout: {
                name: 'Mine',
                layout: {
                    columns: [{
                        id: 'col1',
                        width: '100%',
                        boxes: [
                            {name: 'a', title: 'Alpha', visible: true},
                            {name: 'b', title: 'Beta', visible: true},
                        ],
                    }],
                },
            },
            boxes: {a: {name: 'a', title: 'Alpha', visible: true}, b: {name: 'b', title: 'Beta', visible: true}},
            onMoveBox,
        });

        const column = container.querySelector('[data-box-column="col1"]') as HTMLElement;
        const cards = container.querySelectorAll<HTMLElement>('[data-box-card]');
        expect(column).toHaveAttribute('data-column-length', '2');
        expect(cards).toHaveLength(2);
        expect(cards[1]).toHaveAttribute('data-box-index', '1');

        document.elementFromPoint = jest.fn(() => cards[1]);
        cards.forEach(card => {
            card.getBoundingClientRect = () => ({left: 0, top: 0, width: 300, height: 200, x: 0, y: 0, right: 300, bottom: 200, toJSON: () => ({})});
        });
        const grab = screen.getByLabelText(/Reorder Alpha/);
        // jsdom has no PointerEvent, so fireEvent would drop the coordinates.
        grab.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, clientX: 5, clientY: 5, button: 0}));
        window.dispatchEvent(new MouseEvent('pointermove', {clientX: 100, clientY: 150}));
        window.dispatchEvent(new MouseEvent('pointerup', {clientX: 100, clientY: 150}));

        expect(onMoveBox).toHaveBeenCalledWith('col1', 0, 'col1', 2);
        expect(document.querySelector('[data-box-drag-ghost]')).toBeNull();
    });
});
