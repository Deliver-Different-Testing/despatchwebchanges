// This files contains all the JSDoc types for front end classes/objects

/**
 * @typedef {Object} Job
 *
 * @property {number} id - The ID of the job
 * @property {number} clientId - The ID of the client associated with the job.
 * @property {number} JobNo - The job number
 * @property {number} courierId - The ID of the courier associated with the job.
 * @property {string} deliverToContact - The contact to whom the job will be delivered.
 * @property {string} fromAddress - The address from which the job will be picked up.
 * @property {string} fromSuburb - The suburb from which the job will be picked up.
 * @property {number} fromLong - The longitude of the pickup address.
 * @property {number} fromLat - The latitude of the pickup address.
 * @property {string} toAddress - The address to which the job will be delivered.
 * @property {string} toSuburb - The suburb to which the job will be delivered.
 * @property {number} toLong - The longitude of the delivery address.
 * @property {number} toLat - The latitude of the delivery address.
 * @property {string} date - The date when the job is scheduled.
 * @property {string} fromContactName - The name of the contact from whom the job will be picked up.
 * @property {string} podNames - The name of the POD contact from whom the job will be picked up.
 * @property {string} deliveryNotes - Any notes related to the delivery of the job.
 * @property {string} pickupNotes - Any notes related to the pickup of the job.
 * @property {string} jobNotes - Any other notes related to the job.
 * @property {number} speedId - The ID of the speed at which the job will be performed.
 * @property {boolean} van - Indicator if a van is required for the job.
 * @property {boolean} truck - Indicator if a truck is required for the job.
 * @property {boolean} pedal - Indicator if a pedal vehicle is required for the job.
 * @property {boolean} attention - Indicator to draw attention to the job.
 * @property {boolean} vanOK - Indicator if a van is acceptable for the job.
 * @property {boolean} reprice - Indicator to reprice the job.
 * @property {boolean} void - Indicator if the job is voided.
 * @property {boolean} done - Indicator if the job is done.
 * @property {number} charge - The charge for the job.
 * @property {string} refA - Reference A for the job
 * @property {string} refB - Reference B for the job
 * @property {string} ourRef - Reference B for the job
 * @property {string} childNotes - The jobs for the child job
 * @property {number} pickupFrom - The suburbId the job was picked up from
 * @property {boolean} saturdayDelivery - If job has Saturday Delivery
 * @property {string} jobNo - The job number
 * @property {number} items - The quantity or number of items for the job
 * @property {string} speedName - The name of the jobs selected speed
 * @property {string} notifiedName - The name of the jobs notified name
 * @property {Date} DGLicenseExpiry - Expiry of the DG License attached to the job
 * @property {number} deliveryLongitude
 * @property {number} deliveryLatitude
 * @property {number} pickUpLongitude
 * @property {number} pickUpLatitude
 * @property {string} toSuburbName
 * @property {string} fromSuburbName
 * @property {number} postCode
 * @property {string} extras
 * @property {boolean} bulkJob
 * @property {boolean} preBook
 * @property {number} truckWeightLimit
 * @property {boolean} invoiced
 * @property {boolean} allowSplit
 * @property {number} remain
 * @property {number} minutes
 * @property {Date} pickupTime
 * @property {boolean} alertLatePickup
 * @property {Date} deliveryTime
 * @property {boolean} alertLateDelivery
 * @property {boolean} allowDispatch
 * @property {string} courier
 * @property {number} rootParentID
 * @property {boolean} allowSplit
 * @property {boolean} dgDocumentation
 * @property {string} contactName
 * @property {number} dgClass
 * @property {number} fromSuburbId
 * @property {number} toSuburbID
 * @property {number} speedID
 * @property {number} weight
 * @property {number} acceptedJobTypeID
 * @property {number} speedAccepted
 * @property {number} UDStatus
 * @property {number} internalStatusID
 * @property {string} speed
 * @property {boolean} direct
 * @property {boolean} return
 * @property {Date} completedTime
 * @property {boolean} invoiced
 * @property {number} bulkJobID
 * @property {boolean} ratedManually
 * @property {string} clientNotes
 * @property {string} fromPostCode
 * @property {string} fromContactNumber
 * @property {string} toPostCode
 * @property {string} toCity
 * @property {string} podName
 * @property {boolean} airportOnly
 * @property {number} jobRelationshipTypeID
 * @property {string} internalNotes
 * @property {string} statusName
 * @property {string} phone
 * @property {string} loggedInContactName
 * @property {string} conNote
 * @property {boolean} hasNationwide
 * @property {Date} followupTime
 * @property {string} scheduleName
 * @property {string} runName
 * @property {number} runOrder
 * @property {string} clientName
 * @property {Date} createdDate
 * @property {string} trackingMobile
 * @property {string} trackingEmail
 * @property {string} speed
 * @property {boolean} oneOff
 * @property {string} acceptedName
 * @property {Date} time
 * @property {number} truckHours
 * @property {number} jobType
 * @property {string} status
 * @property {number} statusID
 * @property {number} courierLatitude
 * @property {number} courierLongitude
 * @property {Date} booked - The date the job was booked
 * @property {*} courierData
 */

/**
 * @typedef {Object} ClientItem
 *
 * @property {number} itemId - The ID of the item.
 * @property {number} clientId - The ID of the client that the item belongs to.
 * @property {string} name - The name of the item.
 * @property {string} description - The description of the item.
 * @property {boolean} perItem - True if the rate is calculated per item, otherwise false.
 * @property {number} rate - The rate associated to the item.
 * @property {boolean} onlyVan - True if the item should only be delivered by van, otherwise false.
 * @property {boolean} selected - If the item is added to the job or not
 */

/**
 * @typedef {Object} Query
 *
 * @property {string} order
 * @property {number} limit
 * @property {number} page
 */

/**
 * @typedef {Object} AddressDetails - Details related to the address in use.
 *
 * @property {string} filledAddress - The fully formed address.
 * @property {number} lat - The latitude of the address.
 * @property {number} long - The longitude of the address.
 * @property {string} address - The address.
 * @property {string} extras - The extras.
 * @property {string} suburb - The suburb of the address.
 * @property {string} postCode - The postal code of the address.
 * @property {number} our_suburb - The id of the suburb in urgents db
 */

/**
 * @typedef {Object} Suggestion - A suggested location returned from the autocompleteAddressSearch.
 *
 * @property {string} id - The ID of the location.
 * @property {string} text - The textual representation of the location.
 */

/**
 * @typedef {Object} SuburbOption - An option for selection in the ourSuburbSearch.
 *
 * @property {string} text - The textual representation of the suburb.
 * @property {string} alias - The alias of the suburb.
 */

/**
 * @typedef {Object} Event
 *
 * @property {number} id Unique identifier of the job
 * @property {string} jobNumber Number associated with job
 * @property {string} clientCode Code associated with client
 * @property {Date} eventDate Timestamp when the event is created
 * @property {Date} closedDate
 * @property {string} eventTime Time of the event
 * @property {string} eventType Types of event
 * @property {string} notes Additional notes for the event
 */

/**
 * @typedef {Object} Pallet
 *
 * @property {number} amount - The quantity of pallets.
 * @property {number} weight - The weight of the pallet.
 * @property {number} length - The length of the pallet.
 * @property {number} depth - The depth of the pallet.
 * @property {number} height - The height of the pallet.
 * @property {boolean} pu - (Please define what this property does)
 * @property {boolean} do - (Please define what this property does)
 * @property {number} dgClass - (Please define what this property does)
 * @property {string} notes - Any additional comments or notes related to the pallet.
 * @property {number} itemID
 */

/**
 * @typedef SelectOption
 *
 * @property {number} id - The unique identifier for the select object
 * @property {string} text - The display text for the select object
 */

/**
 * @typedef {object} InterCourierData
 *
 * @property {number} fromCourierId
 * @property {number} toCourierId
 * @property {string} reference
 * @property {number} zones
 * @property {number} amount
 */

/**
 * @typedef {object} Courier
 *
 * @property {number} courierID - The primary key of for the courier
 * @property {number} id - The courier number
 * @property {string} name - The name of the courier
 * @property {number} dangerousGoods - 1 or 0 to show if courier can carry dangerous goods
 * @property {Date} dgLicenseExpiry - Date the couriers dangerous goods license
 * @property {number} totalJobs
 * @property {string} vehicleType
 * @property {string} code
 * @property {number} overDueJobs
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} fleetCode
 * @property {string} label - The label for use in select/autocomplete
 * @property {string} text - The text for use in select/autocomplete. This looks to be a duplicate of label.
 */

/**
 * @typedef {object} FileAttachment
 *
 * @property {string} fileName
 * @property {number} jobId
 * @property {number} size
 * @property {Date} lastModified
 */

/**
 * Represents the status of a truck courier, including their capacity and current load.
 * @typedef {Object} TruckCourierStatus
 * @property {number} ucjbCourierID - The unique identifier for the courier in the UCJB system.
 * @property {string} courierCode - The code assigned to the courier.
 * @property {string} firstName - The first name of the courier.
 * @property {number} maxPallets - The maximum number of pallets the courier can carry.
 * @property {number} maxPayLoad - The maximum payload weight (in kg) the courier can carry.
 * @property {number} currentPallets - The number of pallets currently being carried by the courier.
 * @property {number} currentWeight - The current weight (in kg) being carried by the courier.
 * @property {number} availablePallets - The number of additional pallets the courier can carry.
 * @property {number} availableWeight - The additional weight (in kg) the courier can carry.
 */
