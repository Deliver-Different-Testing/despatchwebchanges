/**
 * A service for writing a greeting message to the user
 * @class
 */
class GreetingService {
    /**
     * Method to greet user based on current time
     * @param {string} userName
     * @returns {string}
     */
    greetUser(userName) {
        const currentHour = new Date().getHours();
        let greeting;

        if (currentHour < 12) {
            greeting = "Good morning";
        } else if (currentHour < 18) {
            greeting = "Good afternoon";
        } else {
            greeting = "Good evening";
        }

        return `${greeting}, ${userName}`;
    }
}

angular.module('uDispatch').service('greetingService', GreetingService);
