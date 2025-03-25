class GreetingService implements angular.IServiceProvider {
    $get() {
        return this;
    }

    greetUser(userName: string): string {
        const currentHour: number = new Date().getHours();
        let greeting: string;

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

export default GreetingService;
