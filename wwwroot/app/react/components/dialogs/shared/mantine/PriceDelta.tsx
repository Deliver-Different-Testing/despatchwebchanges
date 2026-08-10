/**
 * PriceDelta (Mantine)
 *
 * The up/down/flat trend glyph for a price change. Red for an increase, green for a
 * decrease, muted for no movement. Shared by the single-job PriceChangeModal and the
 * multi-job FamilyPriceChangeDialog so both read identically.
 */
import React from 'react';
import {TrendingDown, TrendingUp, MoveRight} from 'lucide-react';
import {Icon} from '../../../common/icon/Icon';

export interface PriceDeltaProps {
    oldPrice: number;
    newPrice: number;
}

export const PriceDelta: React.FC<PriceDeltaProps> = ({oldPrice, newPrice}) => {
    const diff = newPrice - oldPrice;
    if (diff > 0) {
        return <Icon lucide={TrendingUp} size={20} color="var(--mantine-color-red-6)" aria-label="Price increase"/>;
    }
    if (diff < 0) {
        return <Icon lucide={TrendingDown} size={20} color="var(--mantine-color-green-6)" aria-label="Price decrease"/>;
    }
    return <Icon lucide={MoveRight} size={20} color="var(--mantine-color-dimmed)" aria-label="No price change"/>;
};

export default PriceDelta;
