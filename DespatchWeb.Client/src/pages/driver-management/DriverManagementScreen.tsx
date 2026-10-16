import React from 'react';
import {PageFrame} from '../../components/layout/PageFrame';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {DriverManagementPage} from './DriverManagementPage';
import {getSession} from '../../api/session';
import {noopRegisterRefresh, showPageToast} from '../pageToasts';

export const DriverManagementScreen: React.FC = () => (
    <PageFrame section="Operations" title="Drivers">
        <ErrorBoundary>
            <DriverManagementPage
                showToast={showPageToast}
                isUsCustomer={getSession().isUsCustomer ?? false}
                setRefreshCallback={noopRegisterRefresh}
            />
        </ErrorBoundary>
    </PageFrame>
);
