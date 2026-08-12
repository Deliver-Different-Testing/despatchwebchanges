export interface DeleteLayoutDialogProps {
    open: boolean;
    /** Name of the layout being deleted — shown in the header and body. */
    layoutName: string;
    onClose: () => void;
    onConfirm: () => void;
}