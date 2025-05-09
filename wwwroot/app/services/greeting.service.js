"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class GreetingService {
    greetUser(userName) {
        const currentHour = new Date().getHours();
        let greeting;
        if (currentHour < 12) {
            greeting = "Good morning";
        }
        else if (currentHour < 18) {
            greeting = "Good afternoon";
        }
        else {
            greeting = "Good evening";
        }
        return `${greeting}, ${userName}`;
    }
}
exports.default = GreetingService;
