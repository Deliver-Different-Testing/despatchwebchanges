angular
    .module("uDispatch")
    .filter("unique", () => (collection, keyname) => {
        const output = [],
            keys = [];

        angular.forEach(collection, item => {
            const key = item[keyname];
            if (keys.indexOf(key) === -1) {
                keys.push(key);
                output.push(item);
            }
        });

        return output;
    })
    .filter('urlFix', () => $url => {

        const tarea_regex = /(http(s?))\:\/\//gi;
        if (!tarea_regex.test($url)) {
            $url = "http://" + $url;
        }

        return $url;

    })
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
    .filter('switch', () => (input, map) => map[input] || '')
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
    .filter('bytes', () => (bytes, precision) => {
        if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
        if (typeof precision === 'undefined') precision = 1;
        const units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
            number = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) + ' ' + units[number];
    });
