import React from 'react';
import {createPortal} from 'react-dom';

export interface HeaderSlotPortalProps {
    /** The card header DOM node to portal into (from JobSearchShell's renderBoxContent). */
    slot: HTMLElement | null | undefined;
    children: React.ReactNode;
}

/**
 * Renders its children into a panel's header slot via `createPortal` when a slot
 * is provided, otherwise renders them inline where placed. This lets a box keep
 * its control state local while the control visually lives in the gradient
 * header; the inline fallback preserves behaviour when no header slot exists
 * (e.g. the panel used outside the dispatch shell, or in unit tests).
 */
export const HeaderSlotPortal: React.FC<HeaderSlotPortalProps> = ({slot, children}) =>
    slot ? createPortal(children, slot) : <>{children}</>;
