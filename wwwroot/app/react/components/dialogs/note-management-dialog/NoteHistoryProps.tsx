import {NoteHistoryEntry} from "../../../interfaces";

export interface NoteHistoryProps {
    history: NoteHistoryEntry[];
    isLoading: boolean;
    timeZoneAbbr: string;
}