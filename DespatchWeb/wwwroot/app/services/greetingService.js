class GreetingService {
    greetUser(userName) {
        let currentHour = new Date().getHours();
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

// Register the service with the AngularJS module
angular.module('uDispatch').service('greetingService', GreetingService);
