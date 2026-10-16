import React from 'react';
import {render} from '@testing-library/react';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/en-nz';
import {clearSessionContext, setSessionContext, type SessionContextDto} from '../api/session';
import {ThemeBootstrap} from './ThemeBootstrap';

const context = (isUsTenant: boolean): SessionContextDto => ({
    contactId: 1, staffId: null, firstName: null, fullName: null, email: null, dispatcher: null,
    timeZone: null, countryCode: null, isUsTenant, currencyCode: isUsTenant ? 'USD' : 'NZD',
    clientInternal: false, isNetworkPartner: false, visibleFeatures: null, npMapCenter: null, hubUrl: null,
});

describe('ThemeBootstrap', () => {
    afterEach(() => {
        clearSessionContext();
        dayjs.locale('en');
        document.body.className = '';
        document.documentElement.removeAttribute('style');
    });

    it('applies the NZ brand, theme-nz class and en-nz locale before children render', () => {
        setSessionContext(context(false));
        let localeSeenByChild = '';
        const Child = () => {
            localeSeenByChild = dayjs.locale();
            return <span>child</span>;
        };
        const {getByText} = render(<ThemeBootstrap><Child/></ThemeBootstrap>);

        expect(getByText('child')).toBeInTheDocument();
        expect(localeSeenByChild).toBe('en-nz');
        expect(document.body).toHaveClass('theme-nz');
        expect(document.body).not.toHaveClass('theme-us');
        expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#f4c430');
        expect(document.documentElement.style.getPropertyValue('--theme-primary-light')).toBe('rgba(244, 196, 48, 0.15)');
    });

    it('applies the US brand and keeps the en locale', () => {
        setSessionContext(context(true));
        render(<ThemeBootstrap><span/></ThemeBootstrap>);

        expect(dayjs.locale()).toBe('en');
        expect(document.body).toHaveClass('theme-us');
        expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#3bc7f4');
        expect(document.documentElement.style.getPropertyValue('--theme-primary-strong')).toBe('rgba(59, 199, 244, 0.5)');
    });
});
