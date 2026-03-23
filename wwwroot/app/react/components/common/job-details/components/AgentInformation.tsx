/**
 * AgentInformation - Agent details (conditional on job.isAgentAssigned)
 * Uses MUI List items matching the md-list-item two-line pattern.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import StarRateIcon from '@mui/icons-material/StarRate';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import type {IAgent} from '../JobDetails.types';
import {
    cardContainerSx,
    sectionToolbarSx,
    sectionToolbarTitleSx,
    sectionToolbarIconSx,
    listItemTextSlotProps,
    listItemIconSx,
    listItemIconInnerSx,
} from '../JobDetails.styles';

interface AgentInformationProps {
    agent: IAgent;
}

function AgentField({icon: IconComp, label, value}: {icon: React.ComponentType<any>; label: string; value?: string}) {
    if (!value) return null;
    return (
        <ListItem dense sx={{py: 0.25}}>
            <ListItemIcon sx={listItemIconSx}>
                <IconComp sx={listItemIconInnerSx} />
            </ListItemIcon>
            <ListItemText
                primary={label}
                secondary={value}
                slotProps={listItemTextSlotProps}
            />
        </ListItem>
    );
}

export const AgentInformation = React.memo(function AgentInformation({agent}: AgentInformationProps) {
    if (!agent) return null;

    return (
        <Box sx={cardContainerSx}>
            <Box sx={sectionToolbarSx}>
                <SupportAgentIcon sx={sectionToolbarIconSx} />
                <Typography variant="subtitle2" sx={sectionToolbarTitleSx}>
                    Agent Information
                </Typography>
            </Box>
            <List dense disablePadding>
                <AgentField icon={PersonIcon} label="Agent" value={agent.agentName} />
                <AgentField icon={PhoneIcon} label="Phone" value={agent.agentPhone} />
                <AgentField icon={EmailIcon} label="Email" value={agent.agentEmail} />
                <AgentField icon={StarRateIcon} label="Rate" value={agent.agentRate != null ? `$${agent.agentRate.toFixed(2)}` : undefined} />
                <AgentField icon={MilitaryTechIcon} label="Ranking" value={agent.agentRanking} />
            </List>
        </Box>
    );
});
