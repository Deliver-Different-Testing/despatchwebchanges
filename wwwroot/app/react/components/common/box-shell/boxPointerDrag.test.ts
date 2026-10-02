import {startBoxPointerDrag} from './boxPointerDrag';
import {LIQUID_GLASS_STORAGE_KEY} from '../../../hooks/useLiquidGlassPreference';

jest.mock('../../../hooks/glassSupport', () => ({
    ...jest.requireActual('../../../hooks/glassSupport'),
    isLiquidGlassSupported: () => true,
}));

const setRect = (el: Element, left: number, top: number, width: number, height: number) => {
    el.getBoundingClientRect = () => ({
        left, top, width, height, x: left, y: top, right: left + width, bottom: top + height, toJSON: () => ({}),
    });
};

const buildColumn = (id: string, count: number, left: number, length = count) => {
    const column = document.createElement('div');
    column.setAttribute('data-box-column', id);
    column.setAttribute('data-column-length', String(length));
    setRect(column, left, 0, 300, 600);
    const cards: HTMLElement[] = [];
    for (let i = 0; i < count; i++) {
        const card = document.createElement('div');
        card.setAttribute('data-box-card', '');
        card.setAttribute('data-column-id', id);
        card.setAttribute('data-box-index', String(i));
        const header = document.createElement('div');
        header.textContent = `${id}-box${i}`;
        const handle = document.createElement('button');
        header.appendChild(handle);
        card.appendChild(header);
        setRect(card, left, i * 200, 300, 200);
        setRect(header, left, i * 200, 300, 40);
        column.appendChild(card);
        cards.push(card);
    }
    document.body.appendChild(column);
    return {column, cards, handle: (i: number) => cards[i].querySelector('button') as HTMLElement};
};

const mouse = (type: string, x: number, y: number) =>
    window.dispatchEvent(new MouseEvent(type, {clientX: x, clientY: y, bubbles: true}));

const hoverOver = (el: Element | null) => {
    document.elementFromPoint = jest.fn(() => el);
};

const grab = (handle: HTMLElement, source: {columnId: string; index: number}, onMove: jest.Mock) =>
    startBoxPointerDrag(
        {clientX: 10, clientY: 10, button: 0, currentTarget: handle},
        source,
        onMove,
    );

describe('startBoxPointerDrag', () => {
    let col1: ReturnType<typeof buildColumn>;
    let onMove: jest.Mock;

    beforeEach(() => {
        col1 = buildColumn('col1', 3, 0);
        onMove = jest.fn();
    });

    afterEach(() => {
        mouse('pointercancel', 0, 0);
        document.body.innerHTML = '';
    });

    it('ignores a press that never travels past the drag threshold', () => {
        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        mouse('pointermove', 12, 11);
        mouse('pointerup', 12, 11);

        expect(document.querySelector('[data-box-drag-ghost]')).toBeNull();
        expect(onMove).not.toHaveBeenCalled();
    });

    it('lifts a ghost of the header and marks the source card once the pointer travels', () => {
        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        hoverOver(null);
        mouse('pointermove', 60, 80);

        const ghost = document.querySelector('[data-box-drag-ghost]');
        expect(ghost).not.toBeNull();
        expect(ghost).toHaveTextContent('col1-box0');
        expect(ghost).toHaveAttribute('aria-hidden', 'true');
        expect(col1.cards[0]).toHaveAttribute('data-dragging');
    });

    it('frosts the ghost as liquid glass only when the device has opted in', () => {
        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        mouse('pointermove', 60, 80);
        expect(document.querySelector('[data-box-drag-ghost]')).not.toHaveAttribute('data-glass');
        mouse('pointercancel', 0, 0);

        localStorage.setItem(LIQUID_GLASS_STORAGE_KEY, 'on');
        try {
            grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
            mouse('pointermove', 60, 80);
            expect(document.querySelector('[data-box-drag-ghost]')).toHaveAttribute('data-glass');
        } finally {
            localStorage.removeItem(LIQUID_GLASS_STORAGE_KEY);
        }
    });

    it('shows the insertion edge and moves before the card under the upper half', () => {
        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        hoverOver(col1.cards[2]);
        mouse('pointermove', 100, 420);

        expect(col1.cards[2]).toHaveAttribute('data-drop-edge', 'top');

        mouse('pointerup', 100, 420);

        expect(onMove).toHaveBeenCalledWith('col1', 0, 'col1', 2);
        expect(document.querySelector('[data-box-drag-ghost]')).toBeNull();
        expect(col1.cards[0]).not.toHaveAttribute('data-dragging');
        expect(col1.cards[2]).not.toHaveAttribute('data-drop-edge');
    });

    it('moves to the end of the column from the lower half of the last card', () => {
        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        hoverOver(col1.cards[2]);
        mouse('pointermove', 100, 580);

        expect(col1.cards[2]).toHaveAttribute('data-drop-edge', 'bottom');

        mouse('pointerup', 100, 580);
        expect(onMove).toHaveBeenCalledWith('col1', 0, 'col1', 3);
    });

    it('uses the next card as the anchor from the lower half of a middle card', () => {
        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        hoverOver(col1.cards[1]);
        mouse('pointermove', 100, 380);
        mouse('pointerup', 100, 380);

        expect(onMove).toHaveBeenCalledWith('col1', 0, 'col1', 2);
    });

    it('treats a drop that would leave the order unchanged as a cancel', () => {
        grab(col1.handle(1), {columnId: 'col1', index: 1}, onMove);
        hoverOver(col1.cards[1]);
        mouse('pointermove', 100, 220);
        expect(col1.cards[1]).not.toHaveAttribute('data-drop-edge');
        mouse('pointerup', 100, 220);

        hoverOver(col1.cards[2]);
        grab(col1.handle(1), {columnId: 'col1', index: 1}, onMove);
        mouse('pointermove', 100, 420);
        mouse('pointerup', 100, 420);

        expect(onMove).not.toHaveBeenCalled();
    });

    it('resolves a pointer in the gap between cards by its position in the column', () => {
        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        hoverOver(col1.column);
        mouse('pointermove', 100, 399);
        mouse('pointerup', 100, 399);

        expect(onMove).toHaveBeenCalledWith('col1', 0, 'col1', 2);
    });

    it('moves across columns, including into an empty one', () => {
        const col2 = buildColumn('col2', 2, 320);
        const empty = buildColumn('col3', 0, 640, 0);

        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        hoverOver(col2.cards[1]);
        mouse('pointermove', 400, 210);
        mouse('pointerup', 400, 210);
        expect(onMove).toHaveBeenLastCalledWith('col1', 0, 'col2', 1);

        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        hoverOver(empty.column);
        mouse('pointermove', 700, 300);
        expect(empty.column).toHaveAttribute('data-drop-over');
        mouse('pointerup', 700, 300);
        expect(onMove).toHaveBeenLastCalledWith('col1', 0, 'col3', 0);
    });

    it('cancels on Escape and when released outside any column', () => {
        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        hoverOver(col1.cards[2]);
        mouse('pointermove', 100, 420);
        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));

        expect(document.querySelector('[data-box-drag-ghost]')).toBeNull();
        expect(col1.cards[2]).not.toHaveAttribute('data-drop-edge');

        grab(col1.handle(0), {columnId: 'col1', index: 0}, onMove);
        hoverOver(document.body);
        mouse('pointermove', 900, 900);
        mouse('pointerup', 900, 900);

        expect(onMove).not.toHaveBeenCalled();
        expect(document.querySelector('[data-box-drag-ghost]')).toBeNull();
    });

    it('does not start from a non-primary button', () => {
        startBoxPointerDrag(
            {clientX: 10, clientY: 10, button: 2, currentTarget: col1.handle(0)},
            {columnId: 'col1', index: 0},
            onMove,
        );
        mouse('pointermove', 100, 100);

        expect(document.querySelector('[data-box-drag-ghost]')).toBeNull();
    });
});
