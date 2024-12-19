/**
 * @fileoverview Custom Angular filters for the uDispatch module
 * @module uDispatch
 */

angular
    .module("uDispatch")
    /**
     * Filter to remove duplicates from a collection based on a key
     * @ngdoc filter
     * @name unique
     * @param {Array} collection - The array to filter
     * @param {string} keyname - The key to use for uniqueness
     * @returns {Array} - The filtered array
     */
    .filter("unique", () => (collection, keyName) => {
        const output = [],
            keys = [];

        angular.forEach(collection, item => {
            const key = item[keyName];
            if (keys.indexOf(key) === -1) {
                keys.push(key);
                output.push(item);
            }
        });

        return output;
    })
    /**
     * Filter to ensure a URL has a protocol
     * @ngdoc filter
     * @name urlFix
     * @param {string} $url - The URL to fix
     * @returns {string} - The fixed URL
     */
    .filter('urlFix', () => $url => {
        const regExp = /(http(s?))\:\/\//gi;
        if (!regExp.test($url)) {
            $url = "http://" + $url;
        }
        return $url;
    })
    /**
     * Filter to get an item from an array or object by attribute
     * @ngdoc filter
     * @name getByAttr
     * @param {Array|Object} input - The input array or object
     * @param {string} val - The value to search for
     * @param {string} [attr] - The attribute to search in (for arrays)
     * @returns {*} - The found item or null
     */
    .filter('getByAttr', () => (input, val, attr) => {
        if (attr === undefined) {
            for (let k in input) {
                if (k === val) {
                    return input[k];
                }
            }
        } else {
            let i = 0;
            const len = input.length;
            for (; i < len; i++) {
                if (+input[i][attr] === +val) {
                    return input[i];
                }
            }
        }
        return null;
    })
    /**
     * Filter to map input to a value in a provided map
     * @ngdoc filter
     * @name switch
     * @param {*} input - The input to switch
     * @param {Object} map - The map of input to output values
     * @returns {*} - The mapped value or an empty string
     */
    .filter('switch', () => (input, map) => map[input] || '')
    /**
     * Filter to move a selected item to the top of a list
     * @ngdoc filter
     * @name selectedToTop
     * @param {Array} contacts - The array of contacts
     * @param {*} selected - The id of the selected contact
     * @returns {Array} - The reordered array
     */
    .filter('selectedToTop', () => (contacts, selected) => {
        let newList = [];
        angular.forEach(contacts, u => {
            if (u.id === selected) {
                newList.unshift(u);
            } else {
                newList.push(u);
            }
        });
        return newList;
    })
    /**
     * Filter to format byte sizes
     * @ngdoc filter
     * @name bytes
     * @param {number} bytes - The number of bytes
     * @param {number} [precision=1] - The number of decimal places
     * @returns {string} - The formatted byte size
     */
    .filter('bytes', () => (bytes, precision) => {
        if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
        if (typeof precision === 'undefined') precision = 1;
        const units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
            number = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) + ' ' + units[number];
    });
