/**
 * Flight Details Dialog React Module
 *
 * Entry point for the React-based Flight Details Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { FlightDetailsDialog } from './FlightDetailsDialog';
import { FlightData } from './types';
import { IFlightViewModel } from '../../../../components/Nationwide/nationwide.interfaces';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../../components/common/mui-interop/MuiThemeIsland';

interface DialogState {
    open: boolean;
    flight: FlightData | null;
    resolve?: () => void;
}

/**
 * Convert IFlightViewModel to FlightData for the React component
 */
function convertFlightViewModelToFlightData(viewModel: IFlightViewModel): FlightData {
    return {
        airline: viewModel.airline,
        flightNumber: viewModel.flightNumber,
        departureTime: viewModel.departureTime,
        arrivalTime: viewModel.arrivalTime,
        departureAirport: viewModel.departureAirport,
        arrivalAirport: viewModel.arrivalAirport,
        departureTimeZone: viewModel.departureTimeZone,
        arrivalTimeZone: viewModel.arrivalTimeZone,
        duration: viewModel.duration,
        stops: viewModel.stops,
        aircraft: viewModel.aircraft,
        elapsedTime: viewModel.elapsedTime,
        isMultiSegment: viewModel.isMultiSegment,
        flightSegments: viewModel.flightSegments?.map((segment) => ({
            segmentOrder: segment.segmentOrder,
            carrierFsCode: segment.carrierFsCode,
            flightNumber: segment.flightNumber,
            departureTime: segment.departureTime,
            arrivalTime: segment.arrivalTime,
            departureAirportFsCode: segment.departureAirportFsCode,
            arrivalAirportFsCode: segment.arrivalAirportFsCode,
            departureAirportName: segment.departureAirportName,
            arrivalAirportName: segment.arrivalAirportName,
            departureAirportCity: segment.departureAirportCity,
            arrivalAirportCity: segment.arrivalAirportCity,
            departureAirportCountry: segment.departureAirportCountry,
            arrivalAirportCountry: segment.arrivalAirportCountry,
            departureAirportTimeZone: segment.departureAirportTimeZone,
            arrivalAirportTimeZone: segment.arrivalAirportTimeZone,
            departureTerminal: segment.departureTerminal,
            arrivalTerminal: segment.arrivalTerminal,
            elapsedTime: segment.elapsedTime,
            flightEquipmentIataCode: segment.flightEquipmentIataCode,
            aircraftName: segment.aircraftName,
            aircraftType: segment.aircraftType,
            airlineName: segment.airlineName,
            stopsInSegment: segment.stopsInSegment,
        })),
    };
}

/**
 * Flight Details Dialog Manager
 * Manages the lifecycle and state of the dialog.
 */
class FlightDetailsDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {
        open: false,
        flight: null,
    };

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-flight-details-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const handleClose = () => {
            this.dialogState.open = false;
            this.dialogState.resolve?.();
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };
        this.dialogRoot.render(islandTree(
                <MuiThemeIsland>
                {this.dialogState.flight && (
                    <FlightDetailsDialog
                        open={this.dialogState.open}
                        flight={this.dialogState.flight}
                        onClose={handleClose}
                    />
                )}

            </MuiThemeIsland>

        ));
    }

    openFlightDetailsDialog(flightData: IFlightViewModel): Promise<void> {
        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                flight: convertFlightViewModelToFlightData(flightData),
                resolve,
            };
            this.renderDialog();
        });
    }
}

const dialogManager = new FlightDetailsDialogManager();

export function openFlightDetailsDialog(flightData: IFlightViewModel): Promise<void> {
    return dialogManager.openFlightDetailsDialog(flightData);
}

// Expose to window for AngularJS access
window.ReactFlightDetailsDialog = {
    openFlightDetailsDialog: openFlightDetailsDialog,
};

// Create AngularJS module for ocLazyLoad
const flightDetailsDialogReactModule = window.angular!.module(
    'uDispatch.flightDetailsDialogReact',
    []
);

console.log('[FlightDetailsDialogReact] Module registered');

export default flightDetailsDialogReactModule;
