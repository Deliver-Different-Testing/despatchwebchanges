/**
 * App bar geometry, shared between the React toolbar and the AngularJS route
 * templates that size their page containers beneath it.
 *
 * Dependency-free on purpose: `routes.ts` lives in the eagerly-loaded AngularJS
 * bundle, so it must not pull Mantine in via the toolbar component.
 */

/** Bar height, matching Integration Manager's `header={{height: 56}}`. */
export const APP_BAR_HEIGHT_PX = 56;

/** Viewport height remaining below the bar, for full-page mount points. */
export const BELOW_APP_BAR_HEIGHT = `calc(100vh - ${APP_BAR_HEIGHT_PX}px)`;
