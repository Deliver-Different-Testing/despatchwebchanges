/**
 * Service for managing US state information.
 */
class UsStatesService {
    /**
     * Initializes the UsStatesService with a list of US states.
     */
    constructor() {
        /**
         * Array of US state objects, each containing an abbreviation and full name.
         * @type {Array<{abbreviation: string, name: string}>}
         * @private
         */
        this.usStates = [
            {abbreviation: 'AL', name: 'Alabama'},
            {abbreviation: 'AK', name: 'Alaska'},
            {abbreviation: 'AZ', name: 'Arizona'},
            {abbreviation: 'AR', name: 'Arkansas'},
            {abbreviation: 'CA', name: 'California'},
            {abbreviation: 'CO', name: 'Colorado'},
            {abbreviation: 'CT', name: 'Connecticut'},
            {abbreviation: 'DE', name: 'Delaware'},
            {abbreviation: 'FL', name: 'Florida'},
            {abbreviation: 'GA', name: 'Georgia'},
            {abbreviation: 'HI', name: 'Hawaii'},
            {abbreviation: 'ID', name: 'Idaho'},
            {abbreviation: 'IL', name: 'Illinois'},
            {abbreviation: 'IN', name: 'Indiana'},
            {abbreviation: 'IA', name: 'Iowa'},
            {abbreviation: 'KS', name: 'Kansas'},
            {abbreviation: 'KY', name: 'Kentucky'},
            {abbreviation: 'LA', name: 'Louisiana'},
            {abbreviation: 'ME', name: 'Maine'},
            {abbreviation: 'MD', name: 'Maryland'},
            {abbreviation: 'MA', name: 'Massachusetts'},
            {abbreviation: 'MI', name: 'Michigan'},
            {abbreviation: 'MN', name: 'Minnesota'},
            {abbreviation: 'MS', name: 'Mississippi'},
            {abbreviation: 'MO', name: 'Missouri'},
            {abbreviation: 'MT', name: 'Montana'},
            {abbreviation: 'NE', name: 'Nebraska'},
            {abbreviation: 'NV', name: 'Nevada'},
            {abbreviation: 'NH', name: 'New Hampshire'},
            {abbreviation: 'NJ', name: 'New Jersey'},
            {abbreviation: 'NM', name: 'New Mexico'},
            {abbreviation: 'NY', name: 'New York'},
            {abbreviation: 'NC', name: 'North Carolina'},
            {abbreviation: 'ND', name: 'North Dakota'},
            {abbreviation: 'OH', name: 'Ohio'},
            {abbreviation: 'OK', name: 'Oklahoma'},
            {abbreviation: 'OR', name: 'Oregon'},
            {abbreviation: 'PA', name: 'Pennsylvania'},
            {abbreviation: 'RI', name: 'Rhode Island'},
            {abbreviation: 'SC', name: 'South Carolina'},
            {abbreviation: 'SD', name: 'South Dakota'},
            {abbreviation: 'TN', name: 'Tennessee'},
            {abbreviation: 'TX', name: 'Texas'},
            {abbreviation: 'UT', name: 'Utah'},
            {abbreviation: 'VT', name: 'Vermont'},
            {abbreviation: 'VA', name: 'Virginia'},
            {abbreviation: 'WA', name: 'Washington'},
            {abbreviation: 'WV', name: 'West Virginia'},
            {abbreviation: 'WI', name: 'Wisconsin'},
            {abbreviation: 'WY', name: 'Wyoming'}
        ];
    }

    /**
     * Retrieves the list of all US states.
     * @returns {Array<{abbreviation: string, name: string}>} An array of state objects.
     */
    getStates() {
        return this.usStates;
    }

    /**
     * Finds a state by its abbreviation.
     * @param {string} abbreviation - The two-letter state abbreviation.
     * @returns {{abbreviation: string, name: string}|undefined} The state object if found, undefined otherwise.
     */
    getStateByAbbreviation(abbreviation) {
        return this.usStates.find(state => state.abbreviation === abbreviation);
    }

    /**
     * Finds a state by its name.
     * @param {string} name - The full name of the state.
     * @returns {{abbreviation: string, name: string}|undefined} The state object if found, undefined otherwise.
     */
    getStateByName(name) {
        return this.usStates.find(state => state.name.toLowerCase() === name.toLowerCase());
    }
}

angular.module('uDispatch').service('UsStatesService', UsStatesService);
