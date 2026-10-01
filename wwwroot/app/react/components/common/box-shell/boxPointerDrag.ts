import classes from './BoxShell.module.css';
import {isLiquidGlassEnabled} from '../../../hooks/useLiquidGlassPreference';

/*
 * Pointer-driven panel reorder. The browser's native drag-and-drop gives no
 * control over the dragged image (a faint, static screenshot), so the shell
 * lifts a ghost of the panel's header itself: it trails the cursor with a
 * little spring and tilt, an edge marks where the panel will land, and on drop
 * it glides into the slot (or back home when cancelled).
 *
 * Everything is imperative DOM on purpose — 60fps follow must not re-render
 * the panel tree. The shell stays declarative by tagging its DOM:
 *   [data-box-column=<id> data-column-length=<n>]  a column drop zone
 *   [data-box-card data-column-id data-box-index]  a panel card (first child = its header)
 */

export interface BoxDragSource {
    columnId: string;
    index: number;
}

export type BoxMoveHandler = (
    sourceColumnId: string,
    sourceIndex: number,
    targetColumnId: string,
    targetIndex: number,
) => void;

interface GrabEvent {
    clientX: number;
    clientY: number;
    button: number;
    currentTarget: EventTarget | null;
}

interface DropTarget {
    columnId: string;
    index: number;
    column: HTMLElement;
    anchor: HTMLElement | null;
    edge: 'top' | 'bottom' | null;
}

const DRAG_THRESHOLD_PX = 4;
const GHOST_MAX_WIDTH = 420;
const GHOST_BODY_HEIGHT = 56;
const FOLLOW_EASE = 0.3;
const MAX_TILT_DEG = 5;
const LIFT_SCALE = 1.03;
const LAND_MS = 240;
const FADE_MS = 140;
const LAND_EASING = 'cubic-bezier(0.2, 0.9, 0.25, 1)';

let dragActive = false;

const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const resolveDrop = (x: number, y: number, source: BoxDragSource): DropTarget | null => {
    const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-box-column]');
    if (!column) return null;

    const columnId = column.dataset.boxColumn ?? '';
    const cards = Array.from(column.querySelectorAll<HTMLElement>('[data-box-card]'));
    const before = cards.find(card => {
        const rect = card.getBoundingClientRect();
        return y < rect.top + rect.height / 2;
    });
    const index = before ? Number(before.dataset.boxIndex) : Number(column.dataset.columnLength ?? 0);

    // Dropping a panel straight back where it is (or just below itself) changes nothing.
    if (columnId === source.columnId && (index === source.index || index === source.index + 1)) return null;

    return {
        columnId,
        index,
        column,
        anchor: before ?? cards[cards.length - 1] ?? null,
        edge: before ? 'top' : cards.length > 0 ? 'bottom' : null,
    };
};

const markDrop = (drop: DropTarget | null) => {
    document.querySelectorAll('[data-drop-edge]').forEach(el => el.removeAttribute('data-drop-edge'));
    document.querySelectorAll('[data-drop-over]').forEach(el => el.removeAttribute('data-drop-over'));
    if (!drop) return;
    if (drop.anchor && drop.edge) drop.anchor.setAttribute('data-drop-edge', drop.edge);
    else drop.column.setAttribute('data-drop-over', '');
};

const buildGhost = (card: HTMLElement) => {
    const cardRect = card.getBoundingClientRect();
    const header = card.firstElementChild as HTMLElement | null;
    const headerHeight = header?.getBoundingClientRect().height || 44;
    const width = Math.min(cardRect.width, GHOST_MAX_WIDTH);
    const height = Math.min(cardRect.height || Infinity, headerHeight + GHOST_BODY_HEIGHT);

    const ghost = document.createElement('div');
    ghost.className = classes.ghost;
    ghost.setAttribute('data-box-drag-ghost', '');
    ghost.setAttribute('aria-hidden', 'true');
    if (isLiquidGlassEnabled()) ghost.setAttribute('data-glass', '');
    ghost.style.width = `${width}px`;
    ghost.style.height = `${height}px`;

    if (header) {
        const clone = header.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        clone.querySelectorAll('button, a, input, [tabindex]').forEach(el => el.setAttribute('tabindex', '-1'));
        ghost.appendChild(clone);
    }

    const body = document.createElement('div');
    body.className = classes.ghostBody;
    ['82%', '58%', '70%'].forEach(barWidth => {
        const bar = document.createElement('div');
        bar.className = classes.ghostBar;
        bar.style.width = barWidth;
        body.appendChild(bar);
    });
    ghost.appendChild(body);

    return {ghost, cardRect, width, height};
};

/**
 * Begin a pointer drag from a panel's drag handle. `onMove` fires once, when the
 * ghost has landed on a changing drop target; a cancel (Escape, release outside a
 * column, or dropping back in place) never calls it.
 */
export function startBoxPointerDrag(event: GrabEvent, source: BoxDragSource, onMove: BoxMoveHandler): void {
    if (dragActive || event.button !== 0) return;
    const card = (event.currentTarget as Element | null)?.closest<HTMLElement>('[data-box-card]');
    if (!card) return;

    dragActive = true;
    const startX = event.clientX;
    const startY = event.clientY;
    const reduced = prefersReducedMotion();

    let ghost: HTMLElement | null = null;
    let ghostWidth = 0;
    let ghostHeight = 0;
    let grabX = 0;
    let grabY = 0;
    let cx = 0;
    let cy = 0;
    let tilt = 0;
    let pointerX = startX;
    let pointerY = startY;
    let drop: DropTarget | null = null;
    let frame = 0;

    const place = () => {
        if (!ghost) return;
        const scale = reduced ? 1 : LIFT_SCALE;
        ghost.style.transform = `translate3d(${cx}px, ${cy}px, 0) rotate(${tilt}deg) scale(${scale})`;
    };

    const tick = () => {
        const targetX = pointerX - grabX;
        const targetY = pointerY - grabY;
        const stepX = (targetX - cx) * FOLLOW_EASE;
        cx += stepX;
        cy += (targetY - cy) * FOLLOW_EASE;
        tilt = clamp(stepX * 0.4, -MAX_TILT_DEG, MAX_TILT_DEG);
        place();
        frame = requestAnimationFrame(tick);
    };

    const stopTracking = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKeyDown);
        if (frame) cancelAnimationFrame(frame);
        document.body.classList.remove(classes.dragging);
        markDrop(null);
    };

    const settle = (commit?: () => void) => {
        card.removeAttribute('data-dragging');
        dragActive = false;
        commit?.();
    };

    const leaveGhost = () => {
        const el = ghost;
        if (!el) return;
        if (typeof el.animate !== 'function') {
            el.remove();
            return;
        }
        const fade = el.animate([{opacity: 1}, {opacity: 0}], {duration: FADE_MS, fill: 'forwards'});
        fade.onfinish = () => el.remove();
    };

    // Glide the ghost onto `to` (a slot or the origin), then run `after` as it lands.
    const flyTo = (to: DOMRect, after?: () => void) => {
        const el = ghost;
        if (!el || reduced || typeof el.animate !== 'function') {
            settle(after);
            el?.remove();
            return;
        }
        const flight = el.animate(
            [
                {transform: el.style.transform, width: `${ghostWidth}px`, height: `${ghostHeight}px`},
                {transform: `translate3d(${to.left}px, ${to.top}px, 0) rotate(0deg) scale(1)`, width: `${to.width}px`, height: `${to.height}px`},
            ],
            {duration: LAND_MS, easing: LAND_EASING, fill: 'forwards'},
        );
        flight.onfinish = () => {
            settle(after);
            leaveGhost();
        };
    };

    const finish = (target: DropTarget | null) => {
        stopTracking();
        if (!ghost) {
            settle();
            return;
        }
        if (target) {
            const landing = (target.anchor ?? target.column).getBoundingClientRect();
            flyTo(landing, () => onMove(source.columnId, source.index, target.columnId, target.index));
        } else {
            flyTo(card.getBoundingClientRect());
        }
    };

    const activate = () => {
        const built = buildGhost(card);
        ghost = built.ghost;
        ghostWidth = built.width;
        ghostHeight = built.height;
        grabX = (startX - built.cardRect.left) * (built.width / (built.cardRect.width || built.width));
        grabY = Math.min(startY - built.cardRect.top, built.height - 8);
        // Start at the card's own origin so the ghost visibly lifts out of the slot.
        cx = reduced ? pointerX - grabX : built.cardRect.left;
        cy = reduced ? pointerY - grabY : built.cardRect.top;
        ghost.style.transformOrigin = `${grabX}px ${grabY}px`;
        place();
        document.body.appendChild(ghost);
        card.setAttribute('data-dragging', '');
        document.body.classList.add(classes.dragging);
        window.getSelection?.()?.removeAllRanges();
        if (reduced) place();
        else frame = requestAnimationFrame(tick);
    };

    function onPointerMove(e: MouseEvent) {
        pointerX = e.clientX;
        pointerY = e.clientY;
        if (!ghost) {
            if (Math.hypot(pointerX - startX, pointerY - startY) < DRAG_THRESHOLD_PX) return;
            activate();
        }
        if (reduced) {
            cx = pointerX - grabX;
            cy = pointerY - grabY;
            place();
        }
        drop = resolveDrop(pointerX, pointerY, source);
        markDrop(drop);
    }

    function onPointerUp() {
        if (!ghost) {
            stopTracking();
            dragActive = false;
            return;
        }
        finish(drop);
    }

    function onCancel() {
        if (!ghost) {
            stopTracking();
            dragActive = false;
            return;
        }
        finish(null);
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') onCancel();
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKeyDown);
}
