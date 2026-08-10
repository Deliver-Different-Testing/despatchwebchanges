import React from 'react';
import {render} from '@testing-library/react';
import {Search} from 'lucide-react';
import {IconTruck} from '@tabler/icons-react';
import {Icon, DEFAULT_ICON_STROKE, UI_ICON_SIZE} from './Icon';
import {MUI_ICON_MAP} from './iconMap';

describe('Icon', () => {
    it('renders a Lucide icon with the brand 1.25 stroke by default', () => {
        const {container} = render(<Icon lucide={Search} aria-label="search"/>);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute('stroke-width', String(DEFAULT_ICON_STROKE));
        expect(svg).toHaveAttribute('width', String(UI_ICON_SIZE));
    });

    it('renders a Tabler icon with the brand 1.25 stroke', () => {
        const {container} = render(<Icon tabler={IconTruck} aria-label="truck"/>);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute('stroke-width', String(DEFAULT_ICON_STROKE));
    });

    it('honours an explicit size override', () => {
        const {container} = render(<Icon lucide={Search} size={36}/>);
        expect(container.querySelector('svg')).toHaveAttribute('width', '36');
    });

    it('renders nothing when neither library is supplied', () => {
        const {container} = render(<Icon/>);
        expect(container.querySelector('svg')).not.toBeInTheDocument();
    });

    it('maps a chrome glyph to Lucide and a logistics glyph to Tabler', () => {
        expect(MUI_ICON_MAP.Close.lib).toBe('lucide');
        expect(MUI_ICON_MAP.LocalShipping.lib).toBe('tabler');
        const entry = MUI_ICON_MAP.LocalShipping;
        const {container} = render(
            entry.lib === 'tabler'
                ? <Icon tabler={entry.component}/>
                : <Icon lucide={entry.component}/>,
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });
});
