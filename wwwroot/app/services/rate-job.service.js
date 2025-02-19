import app from "../app";

class RateJobService {
    static $inject = ["DispatchData", "moment"];

    constructor(DispatchData, moment) {
        this.dispatchData = DispatchData;
        this.moment = moment;
    }

    /**
     * Rate a job
     * @param {Job} job - A job to rate
     */
    async rateJob(job) {
        //hardcoded 0 pallets, 0 extrastopoffs, 0 dryiceweight, 0 waittime
        /*  return this.dispatchData.rateJobUS(job.id, job.clientId, job.speedId, job.pickupAddress.addressLine7,
              job.deliveryAddress.addressLine7, job.weight, job.booked, job.size.id, job.dgDocumentation, 0, 0, 0, 0,
              job.pickupAddress.latitude, job.pickupAddress.longitude, job.deliveryAddress.latitude, job.deliveryAddress.longitude);*/
        //return job.charge;
        /*const pedal = job.fromSuburbId === 1 && job.toSuburbID === 1 || job.fromSuburbId === 112 && job.toSuburbID === 112 || job.fromSuburbId === 480 && job.toSuburbID === 480;
        if (job.size.id === 4 && (job.speedId === 41 || job.speedId === 42 || job.speedId === 43 || job.speedId === 44 || job.speedId === 46 || job.speedId === 51 || job.speedId === 52 || job.speedId === 124 || job.speedId === 125 || job.speedId === 150 || job.speedId === 151 || job.speedId === 152)) {
            //Truck Job
            const itemSummary = await this.dispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit);
            return this.dispatchData.rateTruckJob(job.clientId, job.fromSuburbId, job.toSuburbID, itemSummary.weight, job.size.id, job.speedId, itemSummary.quantity, job.booked, itemSummary.pickUp, itemSummary.dropOff, job.privateRes, itemSummary.overSize, itemSummary.overWeight, itemSummary.dgClass, job.truckStartTime || this._moment().format("YYYY-MM-DDThh:mm:ss"), job.truckHours || 2);
        } else {
            return this.dispatchData.rateJob(job.clientId, job.fromSuburbId, job.toSuburbID, job.speedId, pedal, job.van, job.return, job.weight, job.size.id, true, job.direct, job.acceptedJobTypeID, job.ourRef || '', job.refA || '', job.refB || '', job.items, job.booked);
        }*/
    }
}

app.service("rateJobService", RateJobService);
