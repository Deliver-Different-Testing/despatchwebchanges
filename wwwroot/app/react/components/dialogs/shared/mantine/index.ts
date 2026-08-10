/**
 * Shared primitives for the DFRNT (Mantine) dialog design language.
 *
 * The Mantine replacement for `dialogs/shared`. New/migrated dialogs compose
 * <DialogShell> + <DialogHeader> + <DialogFooter>; the MUI `shared/` exports
 * are retired once every dialog has moved over.
 */
export {DialogShell, dialogSize} from './DialogShell';
export {DialogHeader} from './DialogHeader';
export {DialogFooter} from './DialogFooter';
export {
    headerColors,
    headerSurfaceAccent,
    headerChromeStyle,
    headerChipStyle,
    headerOnColor,
    headerOverlayColor,
    sectionPaperProps,
    sectionLabelProps,
    dialogContentBg,
    dialogFooterBorder,
} from './styles';
export type {HeaderVariant} from './styles';
export {PriceDelta} from './PriceDelta';
export type {PriceDeltaProps} from './PriceDelta';
export {AgentEmailFields} from './AgentEmailFields';
export type {AgentEmailState} from './AgentEmailFields';
export {DialogFooterProps} from "./DialogFooterProps";
export {DialogShellProps} from "./DialogShellProps";
export {DialogHeaderProps} from "./DialogHeaderProps";
