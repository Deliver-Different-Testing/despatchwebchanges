import React from 'react';
import {Badge, Box, Group} from '@mantine/core';
import {PiggyBank, TrendingUp, Wallet} from 'lucide-react';
import {Icon} from '../../../common/icon/Icon';
import {formatCurrency} from '../../../../utils/currencyUtils';
import {dialogContentBg} from './styles';
import {SummaryCard} from './SummaryCard';

export interface PricingTotals {
    totalRevenue: number;
    totalCost: number;
    profit: number;
    margin: number;
}

/** Mantine palette key for a margin band — green ≥40%, orange ≥20%, red below. */
export const getMarginColor = (margin: number): string => {
    if (margin >= 40) return 'green';
    if (margin >= 20) return 'orange';
    return 'red';
};

export interface PricingSummaryCardsProps {
    totals: PricingTotals;
}

/** Revenue/cost/profit tiles above a pricing table (PriceBreakdownDialog, SplitPricingBreakdownDialog). */
export function PricingSummaryCards({totals}: PricingSummaryCardsProps): React.ReactElement {
    return (
        <Box p="lg" style={{backgroundColor: dialogContentBg}}>
            <Group gap="md" grow align="stretch" wrap="wrap">
                <SummaryCard
                    color="green"
                    icon={<Icon lucide={TrendingUp} size={28}/>}
                    label="Total Revenue"
                    value={formatCurrency(totals.totalRevenue)}
                />
                <SummaryCard
                    color="orange"
                    icon={<Icon lucide={Wallet} size={28}/>}
                    label="Total Cost"
                    value={formatCurrency(totals.totalCost)}
                />
                <SummaryCard
                    color="reflex"
                    icon={<Icon lucide={PiggyBank} size={28}/>}
                    label="Gross Profit"
                    value={formatCurrency(totals.profit)}
                    footer={totals.totalRevenue > 0 ? (
                        <Badge size="sm" mt={4} color={getMarginColor(totals.margin)}>
                            {totals.margin.toFixed(1)}% margin
                        </Badge>
                    ) : undefined}
                />
            </Group>
        </Box>
    );
}

export default PricingSummaryCards;
