/**
 * Flight Details Dialog React Module
 *
 * Entry point for the React-based Flight Details Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';

import { FlightDetailsDialog } from './FlightDetailsDialog';
import { FlightData } from './types';
import { IFlightViewModel } from '../../../../components/Nationwide/nationwide.interfaces';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../../components/common/mui-interop/MuiThemeIsland';
import {createDialogHost} from '../../../utils/reactDialogHost';

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

const host = createDialogHost<{flight: FlightData}, void>({
    containerId: 'react-flight-details-dialog-root',
    render: ({open, payload, close}) => islandTree(
        <MuiThemeIsland>
            <FlightDetailsDialog
                open={open}
                flight={payload.flight}
                onClose={() => close()}
            />
        </MuiThemeIsland>
    ),
});

export function openFlightDetailsDialog(flightData: IFlightViewModel): Promise<void> {
    return host.open({flight: convertFlightViewModelToFlightData(flightData)});
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
