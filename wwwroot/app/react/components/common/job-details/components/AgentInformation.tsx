/**
 * AgentInformation - Agent details card matching the FlightInformation visual style.
 */

import React from 'react';
import {formatCurrency} from '../../../../utils/currencyUtils';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import StarRateIcon from '@mui/icons-material/StarRate';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import type {SxProps, Theme} from '@mui/material';
import type {IAgent} from '../JobDetails.types';
import {
    cardContainerSx,
    cardContentSx,
    cardNotesContainerSx,
    sectionToolbarSx,
    sectionToolbarTitleSx,
    sectionToolbarIconSx,
} from '../JobDetails.styles';

interface AgentInformationProps {
    agent: IAgent;
}

const styles: Record<string, SxProps<Theme>> = {
    nameRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 1.5,
    },
    name: {
        fontWeight: 600,
        fontSize: '1rem',
        color: 'primary.main',
    },
    detailRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        py: 0.5,
    },
    detailIcon: {
        fontSize: 16,
        color: 'text.secondary',
    },
};

function AgentDetailRow({icon: IconComp, value}: {icon: React.ComponentType<any>; value: string}) {
    return (
        <Box sx={styles.detailRow}>
            <IconComp sx={styles.detailIcon} />
            <Typography variant="body2">
                {value}
            </Typography>
        </Box>
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
            <Box sx={cardContentSx}>
                {/* Agent name + ranking/rate chips */}
                <Box sx={styles.nameRow}>
                    <Typography sx={styles.name}>
                        {agent.agentName}
                    </Typography>
                    <Box sx={{display: 'flex', gap: 0.5}}>
                        {agent.agentRanking && (
                            <Chip
                                size="small"
                                icon={<MilitaryTechIcon />}
                                label={agent.agentRanking}
                                variant="outlined"
                            />
                        )}
                        {agent.agentRate != null && (
                            <Chip
                                size="small"
                                icon={<StarRateIcon />}
                                label={formatCurrency(agent.agentRate)}
                                variant="outlined"
                            />
                        )}
                    </Box>
                </Box>

                {/* Contact details */}
                {agent.agentPhone && (
                    <AgentDetailRow icon={PhoneIcon} value={agent.agentPhone} />
                )}
                {agent.agentEmail && (
                    <AgentDetailRow icon={EmailIcon} value={agent.agentEmail} />
                )}
            </Box>
            {agent.agentNotes && (
                <Box sx={cardNotesContainerSx}>
                    <Typography variant="caption" color="text.secondary" sx={{fontWeight: 500}}>
                        Notes:
                    </Typography>
                    <Typography variant="body2">
                        {agent.agentNotes}
                    </Typography>
                </Box>
            )}
        </Box>
    );
});
