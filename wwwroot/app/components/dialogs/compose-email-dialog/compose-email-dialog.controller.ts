import "./compose-email-dialog.styles.less";
import BaseController from "../../base-controller";
import ToastrService from "../../../services/toastr.service";
import IGroupEmailData from "../../driver-management-dashboard/interfaces/IGroupEmailData";
import IDriverEmail from "../../driver-management-dashboard/interfaces/IDriverEmail";

class ComposeEmailDialogController extends BaseController {
    static $inject = [
        "$scope",
        "$timeout",
        "$interval",
        "$log",
        "$mdDialog",
        "toastrService",
        "emailData",
        "title",
        "submitLabel",
        "selectedCouriers"
    ];

    isLoading: boolean = false;

    constructor(
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private $log: angular.ILogService,
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        public emailData: IGroupEmailData,
        public title: string,
        public submitLabel: string,
        public selectedCouriers: IDriverEmail[]
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        // Initialize email data if not provided
        if (!this.emailData) {
            this.emailData = {
                courierIds: [],
                subject: '',
                body: ''
            };
        }

        this.$log.debug('ComposeEmailDialogController initialized with:', {
            emailData: this.emailData,
            courierList: this.selectedCouriers
        });
    }

    $onInit() {
        // Focus on subject field after dialog opens
        this.registerTimeout(() => {
            const subjectField = angular.element('emailSubject');
            if (subjectField) {
                subjectField.focus();
            }
        }, 300);
    }

    getSelectedCount(): number {
        return this.selectedCouriers.length;
    }

    getCourierNames(): string {
        return this.selectedCouriers.map(courier => courier.name).join(', ');
    }

    useTemplate(templateType: string): void {
        switch (templateType) {
            case 'weekly_update':
                this.emailData.subject = 'Weekly Team Update';
                this.emailData.body = `Dear Team,

Here's your weekly update:

• [Update point 1]
• [Update point 2]
• [Update point 3]

Please let me know if you have any questions.

Best regards`;
                break;

            case 'urgent_notice':
                this.emailData.subject = 'URGENT: Important Notice';
                this.emailData.body = `URGENT NOTICE

Dear Team,

This is an important notice regarding:

[Please specify the urgent matter here]

Action required:
• [Action item 1]
• [Action item 2]

Please respond by: [Date/Time]

Thank you for your immediate attention.`;
                break;

            case 'schedule_change':
                this.emailData.subject = 'Schedule Change Notification';
                this.emailData.body = `Dear Team,

Please note the following schedule changes:

Date: [Date]
Original Time: [Original time]
New Time: [New time]
Reason: [Reason for change]

Please confirm receipt of this message.

Thanks for your understanding.`;
                break;

            case 'general_announcement':
                this.emailData.subject = 'Team Announcement';
                this.emailData.body = `Dear Team,

I wanted to share the following announcement:

[Your message here]

If you have any questions or concerns, please don't hesitate to reach out.

Best regards`;
                break;
        }
        this.applyScope();
    }

    private validateEmailData(): boolean {
        // No need to validate courier selection since they're pre-selected
        if (!this.emailData.subject || this.emailData.subject.trim() === '') {
            this.toastrService.showErrorToast("Please enter an email subject");
            return false;
        }

        if (!this.emailData.body || this.emailData.body.trim() === '') {
            this.toastrService.showErrorToast("Please enter an email message");
            return false;
        }

        return true;
    }

    async submit(): Promise<void> {
        this.$log.debug("Starting email submission with data:", this.emailData);
        this.isLoading = true;

        try {
            // Validate the email data
            if (!this.validateEmailData()) {
                this.isLoading = false;
                return;
            }

            // Trim whitespace from subject and body
            this.emailData.subject = this.emailData.subject.trim();
            this.emailData.body = this.emailData.body.trim();

            this.isLoading = false;

            // Return the email data
            this.$mdDialog.hide(this.emailData);
            this.$log.debug("Email dialog submission complete");
        } catch (error) {
            this.isLoading = false;
            this.$log.error("Error in email submit function:", error);
            this.toastrService.showErrorToast(
                "Error preparing email. Please try again or contact support"
            );
            throw error;
        } finally {
            this.applyScope();
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

    clearForm(): void {
        this.emailData.subject = '';
        this.emailData.body = '';
        this.applyScope();
    }
}

export default ComposeEmailDialogController;