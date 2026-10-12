import React from 'react';
import {PageFrame} from '../../components/layout/PageFrame';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {SettingsPage} from './SettingsPage';

export const SettingsScreen: React.FC = () => (
    <PageFrame section="Account" title="Settings" scrollable>
        <ErrorBoundary>
            <SettingsPage/>
        </ErrorBoundary>
    </PageFrame>
);
