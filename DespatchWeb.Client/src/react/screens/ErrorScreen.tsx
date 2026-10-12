import React from 'react';
import {useNavigation} from '../app/NavigationContext';
import {ErrorPage, type ErrorType} from '../pages/error-page/ErrorPage';

export interface ErrorScreenProps {
    errorType: ErrorType;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({errorType}) => {
    const {navigate} = useNavigation();
    return (
        <div style={{height: '100%'}}>
            <ErrorPage
                errorType={errorType}
                onGoHome={() => navigate('home')}
                onGoBack={() => window.history.back()}
            />
        </div>
    );
};
