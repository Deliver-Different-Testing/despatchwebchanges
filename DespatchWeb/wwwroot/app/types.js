// This files contains all the JSDoc types for front end classes/objects

/**
 * @typedef {Object} Job
 *
 * @property {number} id
 * @property {number|null} rootParentId
 * @property {string|null} time - DateTime represented as an ISO string
 * @property {string|null} bookedDate - DateTime represented as an ISO string
 * @property {boolean} direct
 * @property {boolean} van
 * @property {number|null} jobRelationshipTypeId
 * @property {boolean|null} vanOk
 * @property {boolean|null} done
 * @property {boolean} void
 * @property {boolean|null} truck
 * @property {boolean} saturdayDelivery
 * @property {boolean} return
 * @property {boolean|null} pedal
 * @property {boolean|null} reprice
 * @property {boolean} attention
 * @property {number|null} pickupFrom
 * @property {string} jobNo
 * @property {string} speed
 * @property {string} speedName
 * @property {string} source
 * @property {string} notifiedName
 * @property {string} acceptedName
 * @property {number|null} speedId
 * @property {string} notify
 * @property {Vehicle} vehicle
 * @property {number|null} clientId
 * @property {number} jobType
 * @property {string} client
 * @property {string} clientName
 * @property {string} from - Deprecated: Use pickupAddress instead
 * @property {number|null} fromSuburbId - Deprecated: Use pickupAddress instead
 * @property {string} fromSuburbName - Deprecated: Use pickupAddress instead
 * @property {string} fromPostCode - Deprecated: Use pickupAddress instead
 * @property {string} fromAddress - Deprecated: Use pickupAddress instead
 * @property {string} to - Deprecated: Use deliveryAddress instead
 * @property {number|null} toSuburbId - Deprecated: Use deliveryAddress instead
 * @property {string} toSuburbName - Deprecated: Use deliveryAddress instead
 * @property {string} toPostCode - Deprecated: Use deliveryAddress instead
 * @property {string} toAddress - Deprecated: Use deliveryAddress instead
 * @property {string} toCity - Deprecated: Use deliveryAddress instead
 * @property {string} courier
 * @property {number|null} gstRate
 * @property {number|null} remain
 * @property {number|null} pickupTime
 * @property {number|null} deliveryTime
 * @property {number} alertLatePickup
 * @property {number} alertLateDelivery
 * @property {number|null} minutes
 * @property {number|null} statusId
 * @property {string} status
 * @property {string} statusName
 * @property {number|null} lp
 * @property {number|null} ld
 * @property {string} contactName
 * @property {string} loggedInContactName
 * @property {string} deliverToContact
 * @property {number|null} trackingMethod
 * @property {string} trackingMobile
 * @property {string} trackingEmail
 * @property {string} udStatus
 * @property {Uint8Array} podPhoto
 * @property {Uint8Array} deliverySignature
 * @property {Uint8Array[]} podPhotos
 * @property {string} podName
 * @property {string} phone
 * @property {string} speedAccepted
 * @property {number|null} acceptedJobTypeId
 * @property {number|null} notifiedJobTypeId
 * @property {Vehicle} size
 * @property {number|null} weight
 * @property {number|null} items
 * @property {string} refA
 * @property {string} refB
 * @property {string} ourRef
 * @property {string} sigNotRequired
 * @property {string} charge
 * @property {string} date
 * @property {string|null} dispatchTime - DateTime represented as an ISO string
 * @property {string} booked - DateTime represented as an ISO string
 * @property {string|null} puTime - DateTime represented as an ISO string
 * @property {string} clientNotes
 * @property {string} internalNotes
 * @property {string|null} followupTime - DateTime represented as an ISO string
 * @property {number|null} internalStatusId
 * @property {string} childNotes
 * @property {boolean} locked
 * @property {boolean} invoiced
 * @property {number|null} pickUpLongitude
 * @property {number|null} pickUpLatitude
 * @property {number|null} deliveryLongitude
 * @property {number|null} deliveryLatitude
 * @property {Pallet[]} palletInfo
 * @property {Size[]} relatedJobs
 * @property {number|null} courierLatitude
 * @property {number|null} courierLongitude
 * @property {number|null} runOrder
 * @property {CourierData} courierData
 * @property {boolean|null} allowDispatch
 * @property {boolean|null} dgDocumentation
 * @property {number|null} dgClass
 * @property {boolean|null} displaySplitJobDetail
 * @property {number|null} truckWeightLimit
 * @property {string|null} truckStartTime - DateTime represented as an ISO string
 * @property {number|null} truckHours
 * @property {boolean} privateRes
 * @property {boolean|null} allowSplit
 * @property {string|null} completedTime - DateTime represented as an ISO string
 * @property {string} fromContactName
 * @property {string} fromContactNumber
 * @property {boolean} ratedManually
 * @property {number|null} sizeId
 * @property {boolean|null} active
 * @property {boolean|null} oneOff
 * @property {string} inActiveBy
 * @property {string|null} inActiveDate - DateTime represented as an ISO string
 * @property {string|null} firstDue - DateTime represented as an ISO string
 * @property {string|null} nextDue - DateTime represented as an ISO string
 * @property {string|null} lastDone - DateTime represented as an ISO string
 * @property {string|null} stopDate - DateTime represented as an ISO string
 * @property {string|null} restartDate - DateTime represented as an ISO string
 * @property {string} days
 * @property {boolean} preBook
 * @property {boolean} bulkJob
 * @property {string} runName
 * @property {string} scheduleName
 * @property {string} conNote
 * @property {boolean|null} airportOnly
 * @property {boolean} hasNationwide
 * @property {string|null} dispatcherName
 * @property {string|null} createdDate - DateTime represented as an ISO string
 * @property {AddressDetails} pickupAddress
 * @property {AddressDetails} deliveryAddress
 * @property {number} toAirportId
 * @property {number} fromAirportId
 * @property {AssignedFlight} assignedFlight
 * @property {Agent} assignedAgent
 * @property {Suggestion} assignedCourier
 * @property {ParcelDimensions} parcelDimensions
 * @property {number} deliverToLeaveId
 */

/**
 * Represents a comprehensive address details object.
 * @typedef {Object} AddressDetails
 *
 * @property {string} addressLine1 - The first line of the address.
 * @property {string} addressLine2 - The second line of the address.
 * @property {string} addressLine3 - The third line of the address.
 * @property {string} addressLine4 - The fourth line of the address.
 * @property {string} addressLine5 - The fifth line of the address.
 * @property {string} addressLine6 - The sixth line of the address.
 * @property {string} addressLine7 - The seventh line of the address.
 * @property {string} addressLine8 - The eighth line of the address.
 * @property {number|null} latitude - The latitude of the address.
 * @property {number|null} longitude - The longitude of the address.
 * @property {string} fullAddress - The fully formed address.
 * @property {string} filledAddress - The fully formed address (alternative representation).
 * @property {string} address - The main address line.
 * @property {string} extras - Additional address information.
 * @property {string} suburb - The suburb of the address.
 * @property {string} postCode - The postal code of the address.
 * @property {number} our_suburb - The id of the suburb in urgents db.
 */

/**
 * Represents a vehicle.
 * @typedef {Object} Vehicle
 *
 * @property {number|null} id
 * @property {string} label
 */

/**
 * Represents a size.
 * @typedef {Object} Size
 *
 * @property {number} id
 * @property {string} label
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
 * @typedef {Object} Suggestion - A suggested location returned from the autocompleteAddressSearch.
 *
 * @property {number} id - The ID of the location.
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
 * @property {number} id - The ID of the pallet.
 * @property {number} quantity - The quantity of pallets.
 * @property {number} weight - The weight of the pallet in KG.
 * @property {number} length - The length of the pallet in meters.
 * @property {number} depth - The depth of the pallet in meters.
 * @property {number} height - The height of the pallet in meters.
 * @property {boolean} pu - Indicates if it's a pickup.
 * @property {boolean} do - Indicates if it's a delivery.
 * @property {string} dgClass - The dangerous goods class.
 * @property {string} notes - Additional notes for the pallet.
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
 * @typedef {Object} TruckCourierStatus
 *
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

/**
 * @typedef {Object} CourierData
 *
 * @property {string} courier
 * @property {string} location
 * @property {string} pu
 * @property {string} del
 * @property {string} lrm
 * @property {string} eta2lrm
 * @property {number|null} courierID
 * @property {string|null} courierName
 * @property {string|null} courierMobile
 */

/**
 * Represents the envelope (bounding box) of a clear list area.
 * @typedef {Object} ClearListEnvelope
 *
 * @property {number} minimumLatitude - The southernmost latitude of the envelope.
 * @property {number} minimumLongitude - The westernmost longitude of the envelope.
 * @property {number} maximumLatitude - The northernmost latitude of the envelope.
 * @property {number} maximumLongitude - The easternmost longitude of the envelope.
 */

/**
 * Represents the query parameters for job filtering and sorting.
 * @typedef {Object} JobQueryParams
 *
 * @property {string} [status='all'] - The status filter for jobs.
 * @property {string} [order='time'] - The ordering criteria for jobs.
 * @property {string} [asc='asc'] - The sort direction ('asc' for ascending, 'desc' for descending).
 */

/**
 * Represents a flight option with detailed information.
 * @typedef {Object} FlightOptions
 *
 * @property {string} airline - The name of the airline operating the flight.
 * @property {string} flightNumber - The flight number.
 * @property {Date} departureTime - The departure time of the flight (ISO 8601 format).
 * @property {Date} arrivalTime - The arrival time of the flight (ISO 8601 format).
 * @property {string} departureAirport - The code of the departure airport.
 * @property {string} arrivalAirport - The code of the arrival airport.
 * @property {number} duration - The duration of the flight in milliseconds.
 * @property {number} stops - The number of stops on the flight.
 * @property {string} aircraft - The type of aircraft used for the flight.
 * @property {string[]} serviceClasses - An array of service classes available on the flight.
 * @property {boolean} isCodeShare - Indicates whether the flight is a codeshare flight.
 * @property {string|null} codeShareAirline - The airline code of the operating carrier if it's a codeshare flight, null otherwise.
 */

/**
 * Box for displaying widgets in layouts
 * @typedef {Object} Box
 *
 * @property {string} name - The name of the box.
 * @property {string} height - The height of the box.
 */

/**
 * Column layout settings
 * @typedef {Object} Column
 *
 * @property {string} id - The ID of the column.
 * @property {string} width - The width of the column.
 * @property {Box[]} boxes - The boxes contained in the column.
 */

/**
 * Complete layout for a page
 * @typedef {Object} Layout
 *
 * @property {string} name - The name of the layout.
 * @property {Object} layout - The layout configuration.
 * @property {Column[]} layout.columns - The columns in the layout.
 */

/**
 * @typedef {Object} Service
 *
 * @property {number} itemId - The ID of the service item.
 * @property {number} clientId - The ID of the client.
 * @property {string} name - The name of the service.
 * @property {string} description - The description of the service.
 * @property {boolean} perItem - Indicates if the service is charged per item.
 * @property {number} rate - The rate of the service.
 * @property {boolean} onlyVan - Indicates if the service is only for vans.
 * @property {boolean} selected - Indicates if the service is selected.
 */

/**
 * Represents an assigned flight.
 *
 * @typedef {Object} AssignedFlight
 *
 * @property {string} flightNumber - The unique identifier for the flight.
 * @property {Date|null} expectedDeparture - The expected departure date and time of the flight. Can be null.
 * @property {Date|null} expectedArrival - The expected arrival date and time of the flight. Can be null.
 * @property {string} notes - Additional notes or comments about the flight.
 */

/**
 * Represents a view model for an agent.
 *
 * @typedef {Object} Agent
 *
 * @property {number} agentId - The ID of the agent.
 * @property {string} agentName - The name of the agent.
 * @property {number} agentRate - The rate associated with the agent. This is a decimal value.
 * @property {string} agentRanking - The ranking of the agent.
 */

/**
 * Represents a view model for an the price breakdown.
 *
 * @typedef {Object} PriceBreakdown
 *
 * @property {number} chargeId
 * @property {string} name
 * @property {number} amount
 */

/**
 * @typedef {Object} JobDataType
 * @readonly
 * @description Enum-like object defining the different types of job data that can be fetched.
 *
 * @property {string} NEW - Represents new/unassigned jobs
 * @property {string} POD - Represents Proof of Delivery jobs
 * @property {string} REPRICE - Represents jobs requiring repricing
 * @property {string} DELIVERY - Represents delivery booking jobs
 * @property {string} ALL - Special value to indicate all job types should be fetched
 */


/**
 * Represents parcel dimensions with optional measurements
 * @typedef {Object} ParcelDimensions
 *
 * @property {string} [itemName] - Name of the item being measured
 * @property {number} [height] - Height of the parcel in the specified unit
 * @property {number} [length] - Length of the parcel in the specified unit
 * @property {number} [depth] - Depth of the parcel in the specified unit
 * @property {string} [dimensions] - Formatted string of dimensions in 'LxDxH' format
 */
