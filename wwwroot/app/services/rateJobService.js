// Reusable service to rate jobs
class RateJobService {
    static $inject = ["DispatchData"];

    constructor(DispatchData) {
        this.DispatchData = DispatchData;
    }

    async rateJob(job) {
        const pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 ||
            job.fromSuburbID === 112 && job.toSuburbID === 112 ||
            job.fromSuburbID === 480 && job.toSuburbID === 480;

        if (job.size.id === 4 &&
            (job.speedID === 41 ||
                job.speedID === 42 ||
                job.speedID === 43 ||
                job.speedID === 44 ||
                job.speedID === 46 ||
                job.speedID === 51 ||
                job.speedID === 52 ||
                job.speedID === 124 ||
                job.speedID === 125 ||
                job.speedID === 150 ||
                job.speedID === 151 ||
                job.speedID === 152
            )) {
            //Truck Job
            const itemSummary = await this.DispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit);
            return this.DispatchData.rateTruckJob(job.clientID,
                job.fromSuburbID,
                job.toSuburbID,
                itemSummary.weight,
                job.size.id,
                job.speedID,
                itemSummary.quantity,
                job.booked,
                itemSummary.pickUp,
                itemSummary.dropOff,
                job.privateRes,
                itemSummary.overSize,
                itemSummary.overWeight,
                itemSummary.dgClass,
                job.truckStartTime || moment().format("YYYY-MM-DDThh:mm:ss"),
                job.truckHours || 2);
        } else {
            return this.DispatchData.rateJob(job.clientID,
                job.fromSuburbID,
                job.toSuburbID,
                job.speedID,
                pedal,
                job.van,
                job.return,
                job.weight,
                job.size.id,
                true,
                job.direct,
                job.acceptedJobTypeID,
                job.ourRef || '',
                job.refA || '',
                job.refB || '',
                job.items,
                job.booked);
        }
    }
}

angular.module("uDispatch").service("rateJobService", RateJobService);
