/**
 * Sticky Notes React Module
 *
 * Entry point for the React-based StickyNotes component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {StickyNotes} from './StickyNotes';
import {NoteManagementDialogServiceInterface} from './StickyNotes.interfaces';
import {getTheme} from '../../../theme/muiTheme';
import {toastService} from '../../../services/toastService';
import {IAppConfig} from "../../../../interfaces/app-config.interface";

/**
 * AngularJS Component Controller for React StickyNotes
 */
class StickyNotesReactController implements angular.IController {
    static $inject = ['$element', 'noteManagementDialogService', 'APP_CONFIG'];

    private root: Root | null = null;

    // Bindings from AngularJS
    jobId?: number;
    bulkJobId?: number;
    isRecurringJob?: boolean;

    constructor(
        private $element: JQLite,
        private noteManagementDialogService: NoteManagementDialogServiceInterface,
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
                    noteManagementDialogService={this.noteManagementDialogService}
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
