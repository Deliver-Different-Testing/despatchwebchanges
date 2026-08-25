/**
 * The save / rename / delete layout dialogs, wired to {@link useLayoutPrompts}.
 * Dispatch and Job Search render exactly the same three, so they render them from here.
 */

import React from 'react';
import {SaveLayoutDialog} from '../dialogs/save-layout-dialog/SaveLayoutDialog';
import {DeleteLayoutDialog} from '../dialogs/delete-layout-dialog/DeleteLayoutDialog';
import type {LayoutPrompts} from './useLayoutPrompts';

export function LayoutPromptDialogs({prompts, layoutNames}: {
    prompts: LayoutPrompts;
    /** Existing layout names, so the dialogs can reject a duplicate. */
    layoutNames: string[];
}) {
    const {
        saveDialogOpen, resolveSaveLayout,
        renameDialogName, resolveRenameLayout,
        deleteDialogName, resolveDeleteLayout,
    } = prompts;

    return (
        <>
            <SaveLayoutDialog
                open={saveDialogOpen}
                existingNames={layoutNames}
                onClose={() => resolveSaveLayout(null)}
                onConfirm={name => resolveSaveLayout(name)}
            />
            <SaveLayoutDialog
                open={renameDialogName !== null}
                initialName={renameDialogName ?? ''}
                title="Rename Layout"
                subtitle="Give this layout a new name"
                confirmLabel="Rename"
                existingNames={layoutNames.filter(n => n !== renameDialogName)}
                onClose={() => resolveRenameLayout(null)}
                onConfirm={name => resolveRenameLayout(name)}
            />
            <DeleteLayoutDialog
                open={deleteDialogName !== null}
                layoutName={deleteDialogName ?? ''}
                onClose={() => resolveDeleteLayout(false)}
                onConfirm={() => resolveDeleteLayout(true)}
            />
        </>
    );
}
