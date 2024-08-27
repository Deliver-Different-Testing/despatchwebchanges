angular
.module("uDispatch")
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
    }).filter('switch', () => (input, map) => map[input] || '').filter('selectedToTop', () => (contacts, selected) => {
    const newList = [];
    angular.forEach(contacts, u => {
        if (u.id === selected) {
            newList.unshift(u);
        } else {
            newList.push(u);
        }
    });
    return newList;
});
