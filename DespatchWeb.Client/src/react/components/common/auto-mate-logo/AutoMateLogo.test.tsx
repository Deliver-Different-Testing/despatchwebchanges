import React from 'react';
import {screen} from '@testing-library/react';
import {AUTO_MATE_LOGO_ANIMATED_SRC, AUTO_MATE_LOGO_SRC, AutoMateLogo} from './AutoMateLogo';
import {renderWithMantine} from '../../../__testUtils__';

describe('AutoMateLogo', () => {
    it('renders the static Auto-mate logo by default with accessible alt text', () => {
        renderWithMantine(<AutoMateLogo />);

        const logo = screen.getByAltText('Auto-mate');
        expect(logo).toBeInTheDocument();
        expect(logo).toHaveAttribute('src', AUTO_MATE_LOGO_SRC);
    });

    it('renders the animated variant when animated is set', () => {
        renderWithMantine(<AutoMateLogo animated />);

        expect(screen.getByAltText('Auto-mate')).toHaveAttribute('src', AUTO_MATE_LOGO_ANIMATED_SRC);
    });

    it('applies the requested square size', () => {
        renderWithMantine(<AutoMateLogo size={28} />);

        const logo = screen.getByAltText('Auto-mate');
        expect(logo).toHaveStyle({width: '28px', height: '28px'});
    });
});
