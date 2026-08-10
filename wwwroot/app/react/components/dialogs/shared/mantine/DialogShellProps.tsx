import type {ModalProps} from "@mantine/core";

export interface DialogShellProps extends Omit<ModalProps, 'title' | 'opened' | 'onClose'> {
    opened: boolean;
    onClose: () => void;
    /** Modal width. Defaults to `dialogSize.sm` (the design's ~480–600 band). */
    size?: ModalProps['size'];
    /**
     * Accessible name for the dialog — normally the header title.
     *
     * It has to be a literal label rather than an `aria-labelledby` pointing at
     * the visible title: Mantine derives `aria-labelledby` from its own
     * `Modal.Title` slot and writes `undefined` over anything we pass when that
     * slot is unused, which it always is under this design language (the header
     * is `<DialogHeader>`, not Mantine's).
     */
    label?: string;
}