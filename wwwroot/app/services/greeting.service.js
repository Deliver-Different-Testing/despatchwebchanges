import app from "../app";

class GreetingService {
    /**
     * Returns a time-appropriate greeting for the user
     * @param {string} userName - The name of the user to greet
     * @returns {string} The formatted greeting message
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

app.service("greetingService", GreetingService);
