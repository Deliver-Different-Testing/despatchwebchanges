import type {AgentInfo} from '../../../types';

export interface AgentInfoDialogProps {
    open: boolean;
    agent: AgentInfo | null;
    isLoading: boolean;
    onClose: () => void;
}
