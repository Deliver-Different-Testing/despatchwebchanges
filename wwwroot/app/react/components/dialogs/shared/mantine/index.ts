/**
 * Shared primitives for the DFRNT (Mantine) dialog design language.
 *
 * The Mantine replacement for `dialogs/shared`. New/migrated dialogs compose
 * <DialogShell> + <DialogHeader> + <DialogFooter>; the MUI `shared/` exports
 * are retired once every dialog has moved over.
 */
export {DialogShell} from './DialogShell';
export type {DialogShellProps} from './DialogShell';
export {DialogHeader} from './DialogHeader';
export type {DialogHeaderProps} from './DialogHeader';
export {DialogFooter} from './DialogFooter';
export type {DialogFooterProps} from './DialogFooter';
export {headerColors, sectionPaperProps, dialogContentBg, dialogFooterBorder} from './styles';
export type {HeaderVariant} from './styles';
