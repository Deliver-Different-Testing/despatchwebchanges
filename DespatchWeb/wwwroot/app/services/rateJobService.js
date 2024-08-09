/**
 * @typedef {Object} Job
 * @property {number} fromSuburbID - The ID of the suburb from where the job starts.
 * @property {number} toSuburbID - The ID of the suburb where the job ends.
 * @property {Object} size - The size of the job.
 * @property {number} size.id - The ID of the size.
 * @property {number} speedID - The ID of the job speed.
 * @property {string|null} truckStartTime - The start time of the truck for the job or current time if not set.
 * @property {number} truckHours - Duration of the truck hire in hours.
 * @property {number|null} truckWeightLimit - The weight limit for the truck.
 * @property {boolean} pedal - A Boolean indicating whether the job is a pedal job.
 * @property {boolean} van - A Boolean indicating whether the job is a van job.
 * @property {boolean} return - A Boolean indicating whether the job has return.
 * @property {number} weight - Weight of the job.
 * @property {boolean} true - A Boolean: serves unknown purpose in this context.
 * @property {boolean} direct - A Boolean indicating whether the job is direct.
 * @property {number} acceptedJobTypeID - The ID of the accepted job type.
 * @property {string} ourRef - Our reference for the job.
 * @property {string} refA - The A reference for the job.
 * @property {string} refB - The B reference for the job.
 * @property {Array} items - Items for the job.
 * @property {Date} booked - The date the job was booked.
 */

/**
 * A service for rating jobs - determines the cost of hiring and dispatching for a job
 * @class
 */
class RateJobService {
    static $inject = ["DispatchData", "moment"];

    /**
     * Create a RateJobService
     * @param DispatchData - A service for working with job data
     * @param moment - AngularJS directive for moment.js
     */
    constructor(DispatchData, moment) {
        this._dispatchData = DispatchData;
        this._moment = moment;
    }

    /**
     * Rate a job
     * @param {Job} job - A job to rate
     */
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
            const itemSummary = await this._dispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit);
            return this._dispatchData.rateTruckJob(job.clientID,
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
                job.truckStartTime || this._moment().format("YYYY-MM-DDThh:mm:ss"),
                job.truckHours || 2);
        } else {
            return this._dispatchData.rateJob(job.clientID,
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
