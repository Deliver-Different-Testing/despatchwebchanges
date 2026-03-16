/**
 * Sticky Notes React Module
 *
 * Entry point for the React-based StickyNotes component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {StickyNotes} from './StickyNotes';
import {NoteManagementDialogServiceInterface} from './StickyNotes.interfaces';
import {getTheme} from '../../../theme/muiTheme';
import {toastService} from '../../../services/toastService';
import {IAppConfig} from "../../../../interfaces/app-config.interface";
import {JobNote} from '../../../interfaces';
import {openNoteManagementDialog} from '../../dialogs/note-management-dialog/note-management-dialog-react.module';
import angular from 'angular';

/**
 * Wrapper service that uses React dialog but conforms to old interface
 */
const reactNoteManagementDialogService: NoteManagementDialogServiceInterface = {
    openNoteDialog: async (_event: MouseEvent, model: JobNote | null): Promise<void> => {
        await openNoteManagementDialog(model);
    }
};

/**
 * AngularJS Component Controller for React StickyNotes
 */
class StickyNotesReactController implements angular.IController {
    static $inject = ['$element', 'APP_CONFIG'];

    private root: Root | null = null;

    // Bindings from AngularJS
    jobId?: number;
    bulkJobId?: number;
    isRecurringJob?: boolean;

    constructor(
        private $element: JQLite,
        private appConfig: IAppConfig
    ) {}

    $onInit(): void {
        this.root = createRoot(this.$element[0]);
        this.render();
    }

    $onChanges(): void {
        this.render();
    }

    $onDestroy(): void {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
    }

    private render(): void {
        if (!this.root) return;

        const currentTheme = getTheme();

        this.root.render(
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <StickyNotes
                    jobId={this.jobId}
                    bulkJobId={this.bulkJobId}
                    isRecurringJob={this.isRecurringJob}
                    noteManagementDialogService={reactNoteManagementDialogService}
                    showSuccessToast={(msg) => toastService.showSuccessToast(msg)}
                    showErrorToast={(msg) => toastService.showErrorToast(msg)}
                    showInfoToast={(msg) => toastService.showInfoToast(msg)}
                    isUsCustomer={this.appConfig.US_Customer}
                />
            </ThemeProvider>
        );
    }
}

/**
 * AngularJS component definition for React StickyNotes
 */
export const StickyNotesReactComponent: angular.IComponentOptions = {
    controller: StickyNotesReactController,
    bindings: {
        jobId: '<',
        bulkJobId: '<',
        isRecurringJob: '<',
    },
};

export default StickyNotesReactComponent;
