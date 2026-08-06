/**
 * PriceDelta
 *
 * The up/down/flat trend glyph for a price change. Red for an increase, green for a
 * decrease, muted for no movement. Shared by the single-job PriceChangeModal and the
 * multi-job FamilyPriceChangeDialog so both read identically.
 */
import React from 'react';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

export interface PriceDeltaProps {
    oldPrice: number;
    newPrice: number;
}

export const PriceDelta: React.FC<PriceDeltaProps> = ({oldPrice, newPrice}) => {
    const diff = newPrice - oldPrice;
    if (diff > 0) return <TrendingUpIcon sx={{fontSize: 20, color: 'error.main'}} titleAccess="Price increase"/>;
    if (diff < 0) return <TrendingDownIcon sx={{fontSize: 20, color: 'success.main'}} titleAccess="Price decrease"/>;
    return <TrendingFlatIcon sx={{fontSize: 20, color: 'text.secondary'}} titleAccess="No price change"/>;
};

export default PriceDelta;
