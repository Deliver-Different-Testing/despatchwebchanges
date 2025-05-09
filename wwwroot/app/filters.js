"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
app_1.default
    .filter("unique", () => (collection, keyName) => {
    const output = [], keys = [];
    collection.forEach(item => {
        const key = item[keyName];
        if (keys.indexOf(key) === -1) {
            keys.push(key);
            output.push(item);
        }
    });
    return output;
})
    .filter("urlFix", () => ($url) => {
    const regExp = /(http(s?))\:\/\//gi;
    if (!regExp.test($url)) {
        $url = `http://${$url}`;
    }
    return $url;
})
    .filter("getByAttr", () => (input, val, attr) => {
    if (attr === undefined) {
        const obj = input;
        for (let k in obj) {
            if (k === val) {
                return obj[k];
            }
        }
    }
    else {
        const arr = input;
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
    .filter("switch", () => (input, map) => map[input] || "")
    .filter("selectedToTop", () => (contacts, selected) => {
    const newList = [];
    contacts.forEach(u => {
        if (u.id === selected) {
            newList.unshift(u);
        }
        else {
            newList.push(u);
        }
    });
    return newList;
})
    .filter("bytes", () => (bytes, precision) => {
    if (isNaN(parseFloat(bytes)) || !isFinite(bytes))
        return "-";
    if (typeof precision === "undefined")
        precision = 1;
    const units = ["bytes", "kB", "MB", "GB", "TB", "PB"], number = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) + " " + units[number];
})
    .filter("jobStatusIcon", () => {
    return (status) => {
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
    .filter("replace", () => (input, search, replacement) => {
    if (!input)
        return input;
    return input.replace(new RegExp(search, "g"), replacement);
});
