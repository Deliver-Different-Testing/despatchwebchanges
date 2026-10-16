import type {JobChangeRequestDto} from "../../types/jobChangeRequest";

export interface PendingChangeBadgeProps {
    request: JobChangeRequestDto;
    variant?: 'corner' | 'inline';
}