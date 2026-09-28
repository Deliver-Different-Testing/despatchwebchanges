/**
 * AgentInformation - Agent details card matching the FlightInformation visual style.
 */

import React from 'react';
import {Badge, Box, Group, Paper, Text} from '@mantine/core';
import {Award, Headset, Mail, Phone, Star} from 'lucide-react';
import {formatCurrency} from '../../../../utils/currencyUtils';
import {Icon, type LucideIcon} from '../../icon/Icon';
import type {IAgent} from '../JobDetails.types';
import {
    cardContainerProps,
    cardContentStyle,
    cardNotesContainerStyle,
} from '../JobDetails.styles';
import {SectionHeader} from './SectionHeader';

interface AgentInformationProps {
    agent: IAgent;
}

function AgentDetailRow({icon, value}: {icon: LucideIcon; value: string}) {
    return (
        <Group gap={6} style={{paddingBlock: 4}}>
            <Icon lucide={icon} size={16} color="var(--mantine-color-dimmed)" aria-hidden/>
            <Text size="sm">{value}</Text>
        </Group>
    );
}

export const AgentInformation = React.memo(({agent}: AgentInformationProps) => {
    if (!agent) return null;

    return (
        <Paper {...cardContainerProps}>
            <SectionHeader lucide={Headset} title="Agent Information"/>
            <Box style={cardContentStyle(false)}>
                {/* Agent name + ranking/rate chips */}
                <Group justify="space-between" mb={12}>
                    <Text style={{fontWeight: 600, fontSize: '1rem'}} c="var(--mantine-primary-color-filled)">
                        {agent.agentName}
                    </Text>
                    <Group gap={4}>
                        {agent.agentRanking && (
                            <Badge size="sm" variant="default" tt="none" leftSection={<Icon lucide={Award} size={14}/>}>
                                {agent.agentRanking}
                            </Badge>
                        )}
                        {agent.agentRate != null && (
                            <Badge size="sm" variant="default" tt="none" leftSection={<Icon lucide={Star} size={14}/>}>
                                {formatCurrency(agent.agentRate)}
                            </Badge>
                        )}
                    </Group>
                </Group>

                {/* Contact details */}
                {agent.agentPhone && <AgentDetailRow icon={Phone} value={agent.agentPhone}/>}
                {agent.agentEmail && <AgentDetailRow icon={Mail} value={agent.agentEmail}/>}
            </Box>
            {agent.agentNotes && (
                <Box style={cardNotesContainerStyle}>
                    <Text size="xs" c="dimmed" fw={500}>Notes:</Text>
                    <Text size="sm">{agent.agentNotes}</Text>
                </Box>
            )}
        </Paper>
    );
});
