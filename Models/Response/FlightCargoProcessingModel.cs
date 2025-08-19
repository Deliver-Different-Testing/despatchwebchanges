using System;

namespace DespatchWeb.Models.Response;

public class FlightCargoProcessingModel
{
    private DateTime _arrivalTime;
    private int _processingTimeMins;
    private DateTime _cargoOpeningTime;
    private DateTime _cargoClosingTime;

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

    public DateTime PackageReadyTime { get; private set; }

    private void CalculatePackageReadyTime()
    {
        ArrivalWithProcessingTime = ArrivalTime.AddMinutes(ProcessingTimeMins);

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
                                       DateTime cargoOpeningTime, DateTime cargoClosingTime)
    {
        _arrivalTime = arrivalTime;
        _processingTimeMins = processingTimeMins;
        _cargoOpeningTime = cargoOpeningTime;
        _cargoClosingTime = cargoClosingTime;
        CalculatePackageReadyTime();
    }
}