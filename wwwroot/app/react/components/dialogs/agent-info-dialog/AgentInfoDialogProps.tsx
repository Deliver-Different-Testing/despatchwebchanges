import type {AgentInfo} from '../../../interfaces';

export interface AgentInfoDialogProps {
    open: boolean;
    agent: AgentInfo | null;
    isLoading: boolean;
    onClose: () => void;
}
