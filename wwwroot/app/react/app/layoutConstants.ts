import type {CSSProperties} from 'react';
import {BELOW_APP_BAR_HEIGHT} from '../components/common/app-toolbar/appBarMetrics';

export {APP_BAR_HEIGHT_PX, BELOW_APP_BAR_HEIGHT} from '../components/common/app-toolbar/appBarMetrics';

/** Page body beneath the app bar; matches the containers the AngularJS route templates sized. */
export const pageBodyStyle = (scrollable: boolean): CSSProperties => ({
    height: BELOW_APP_BAR_HEIGHT,
    overflow: scrollable ? 'auto' : 'hidden',
});
