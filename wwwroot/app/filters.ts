import app from "./app";

app
    .filter("unique", () => (collection: any[], keyName: string): any[] => {
        const output: any[] = [], keys: any[] = [];

        collection.forEach(item => {
            const key = item[keyName];
            if (keys.indexOf(key) === -1) {
                keys.push(key);
                output.push(item);
            }
        });

        return output;
    })
    .filter("urlFix", () => ($url: string): string => {
        const regExp = /(http(s?))\:\/\//gi;
        if (!regExp.test($url)) {
            $url = `http://${$url}`;
        }
        return $url;
    })
    .filter("getByAttr", () => (input: any[] | Record<string, any>, val: string, attr?: string): any => {
        if (attr === undefined) {
            const obj = input as Record<string, any>;
            for (let k in obj) {
                if (k === val) {
                    return obj[k];
                }
            }
        } else {
            const arr = input as any[];
            let i = 0;
            const len = arr.length;
            for (; i < len; i++) {
                if (+arr[i][attr] === +val) {
                    return arr[i];
                }
            }
        }
        return null;
    })
    .filter("switch", () => (input: any, map: Record<string, any>): any => map[input] || "")
    .filter("selectedToTop", () => (contacts: any[], selected: any): any[] => {
        const newList: any[] = [];
        contacts.forEach(u => {
            if (u.id === selected) {
                newList.unshift(u);
            } else {
                newList.push(u);
            }
        });
        return newList;
    })
    .filter("bytes", () => (bytes: number, precision?: number): string => {
        if (isNaN(parseFloat(bytes as any)) || !isFinite(bytes)) return "-";
        if (typeof precision === "undefined") precision = 1;
        const units = ["bytes", "kB", "MB", "GB", "TB", "PB"], number = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) + " " + units[number];
    })
    .filter("jobStatusIcon", () => {
        return (status: string): string => {
            switch (status.toUpperCase()) {
                case "NEW":
                    return "fiber_new";
                case "PICKEDUP":
                    return "local_shipping";
                case "ACCEPTED":
                    return "check_circle";
                case "DISPATCHED":
                    return "send";
                default:
                    return "info";
            }
        };
    })
    .filter("replace", () => (input: string, search: string, replacement: string): string => {
        if (!input) return input;
        return input.replace(new RegExp(search, "g"), replacement);
    })
    .directive('ngRightClick', ['$parse', ($parse: angular.IParseService): angular.IDirective => ({
            restrict: 'A',
            link: function (scope: angular.IScope, element: angular.IAugmentedJQuery, attrs: angular.IAttributes): void {
                const fn = $parse(attrs.ngRightClick);

                element.on('contextmenu', (event: JQueryEventObject): boolean => {
                        event.preventDefault();

                        scope.$apply((): void => {
                            fn(scope, { $event: event });
                        });

                        return false;
                    });
            }
        })]);