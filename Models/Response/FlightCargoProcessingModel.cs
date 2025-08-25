using System;

namespace DespatchWeb.Models.Response;

public class FlightCargoProcessingModel
{
    private DateTime _arrivalTime;
    private int _processingTimeMins;
    private DateTime _cargoOpeningTime;
    private DateTime _cargoClosingTime;
    private DateTime? _deliverByTime;

    public DateTime ArrivalTime 
    { 
        get => _arrivalTime;
        set 
        {
            _arrivalTime = value;
            CalculatePackageReadyTime();
        }
    }

    public int ProcessingTimeMins 
    { 
        get => _processingTimeMins;
        set 
        {
            _processingTimeMins = value;
            CalculatePackageReadyTime();
        }
    }

    public DateTime ArrivalWithProcessingTime { get; private set; }

    public DateTime CargoOpeningTime 
    { 
        get => _cargoOpeningTime;
        set 
        {
            _cargoOpeningTime = value;
            CalculatePackageReadyTime();
        }
    }

    public DateTime CargoClosingTime 
    { 
        get => _cargoClosingTime;
        set 
        {
            _cargoClosingTime = value;
            CalculatePackageReadyTime();
        }
    }

    public DateTime? DeliverByTime 
    { 
        get => _deliverByTime;
        set 
        {
            _deliverByTime = value;
            CalculatePackageReadyTime();
        }
    }

    public bool? IsDeliveryTimeWithinCargoWindow { get; private set; }

    public DateTime PackageReadyTime { get; private set; }

    private void CalculatePackageReadyTime()
    {
        ArrivalWithProcessingTime = ArrivalTime.AddMinutes(ProcessingTimeMins);

        // Set the delivery window flag if DeliverByTime is provided
        if (DeliverByTime.HasValue)
        {
            var deliveryTime = DeliverByTime.Value.TimeOfDay;
            var openingTime = CargoOpeningTime.TimeOfDay;
            var closingTime = CargoClosingTime.TimeOfDay;
            
            IsDeliveryTimeWithinCargoWindow = deliveryTime >= openingTime && 
                                            deliveryTime <= closingTime;
        }
        else
        {
            IsDeliveryTimeWithinCargoWindow = null;
        }

        if (ArrivalWithProcessingTime >= CargoOpeningTime && ArrivalWithProcessingTime <= CargoClosingTime)
        {
            PackageReadyTime = ArrivalWithProcessingTime;
        }
        else
        {
            PackageReadyTime = ArrivalWithProcessingTime < CargoOpeningTime ? CargoOpeningTime :
                CargoOpeningTime.AddDays(1);
        }
    }

    public FlightCargoProcessingModel(DateTime arrivalTime, int processingTimeMins, 
                                       DateTime cargoOpeningTime, DateTime cargoClosingTime,
                                       DateTime? deliverByTime = null)
    {
        _arrivalTime = arrivalTime;
        _processingTimeMins = processingTimeMins;
        _cargoOpeningTime = cargoOpeningTime;
        _cargoClosingTime = cargoClosingTime;
        _deliverByTime = deliverByTime;
        CalculatePackageReadyTime();
    }
}