import "./recovery-agent-management.styles.less";
import {IAgent, Suggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import NationwideService from "../../Nationwide/nationwide.service";
import ToastrService from "../../../services/toastr.service";
import {
    AddAgentRecoveryRequest,
    RecoveryAgentJobViewModel, RecoveryAgentViewModel,
    RecoveryJobViewModel,
    UpdateAgentRecoveryRequest
} from "./recovery-agent-management-dialog.interfaces";

class RecoveryAgentManagementController extends BaseController {
    static $inject = [
        '$mdDialog',
        'NWData',
        'toastrService',
        '$window',
        'job',
    ];

    selectedAirport?: Suggestion;
    selectedAgent?: IAgent;
    showAssignForm: boolean = false;
    showEditForm: boolean = false;
    isPrimaryRecoveryAgent: boolean = false;
    editIsPrimaryRecoveryAgent: boolean = false;
    editingAgent?: RecoveryAgentViewModel;
    selectedRecoveryJob?: RecoveryJobViewModel;

    agentOptions?: Suggestion[];
    airportOptions?: Suggestion[];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private nationwideService: NationwideService,
        private toastrService: ToastrService,
        private $window: angular.IWindowService,
        public job: RecoveryAgentJobViewModel,
    ) {
        super();
        console.log('RecoveryAgentManagementController: Controller instantiated');
        this.initAirports();
    }

    private initAirports() {
        this.nationwideService.getAllActiveAirports().then(airports => {
            this.airportOptions = airports;
        });
    }

    async getAgentOptionsForAirport(airport: Suggestion) {
        if (!airport) {
            this.agentOptions = [];
            return;
        }

        this.agentOptions = await this.nationwideService.getAgentOptionsByAirport(airport.id);
    }

    showAssignAgentForm(recoveryJob?: RecoveryJobViewModel): void {
        this.selectedRecoveryJob = recoveryJob || undefined;
        this.showAssignForm = true;
        this.isPrimaryRecoveryAgent = false;
    }

    hideAssignAgentForm(): void {
        this.showAssignForm = false;
        this.selectedAirport = undefined;
        this.selectedAgent = undefined;
        this.selectedRecoveryJob = undefined;
        this.isPrimaryRecoveryAgent = false;
        this.agentOptions = [];
    }

    showEditAgentForm(agent: RecoveryAgentViewModel): void {
        this.editingAgent = agent;
        this.editIsPrimaryRecoveryAgent = agent.primaryRecoveryAgent || false;
        this.showEditForm = true;
    }

    hideEditAgentForm(): void {
        this.showEditForm = false;
        this.editingAgent = undefined;
        this.editIsPrimaryRecoveryAgent = false;
    }

    onPrimaryCheckboxChange(): void {
        // This method can be used to show/hide warnings or perform validations
        // when the primary checkbox state changes
    }

    onEditPrimaryCheckboxChange(): void {
        // This method can be used to show/hide warnings or perform validations
        // when the edit primary checkbox state changes
    }

    hasPrimaryRecoveryAgent(): boolean {
        if (!this.job || !this.job.recoveryJobs) return false;

        return this.job.recoveryJobs.some(recoveryJob =>
                recoveryJob.recoveryAgents && recoveryJob.recoveryAgents.some(agent =>
                    agent.primaryRecoveryAgent
                )
        );
    }

    async assignAgent(): Promise<void> {
        if (!this.selectedAirport || !this.selectedAgent) {
            this.toastrService.showWarningToast('Please select both airport and agent');
            return;
        }

        try {
            const addAgentRequest: AddAgentRecoveryRequest = {
                jobId: this.job.jobId,
                agentId: this.selectedAgent.agentId,
                airportId: this.selectedAirport.id,
                isPrimaryRecoveryAgent: this.isPrimaryRecoveryAgent
            };

            await this.nationwideService.addAgentRecoveryJob(addAgentRequest);

            // Refresh the job data to get the updated assignments
            this.job = await this.nationwideService.getAgentRecoveryJobs(this.job.jobId);

            this.hideAssignAgentForm();

            const agentTypeText = this.isPrimaryRecoveryAgent ? 'primary recovery agent' : 'recovery agent';
            this.toastrService.showSuccessToast(`${this.selectedAgent.agentName} has been assigned as ${agentTypeText} to search at ${this.selectedAirport.text}`);
        } catch (error) {
            console.error('Error assigning agent:', error);
            this.toastrService.showErrorToast('Failed to assign agent. Please try again.');
        }
    }

    async updateAgent(): Promise<void> {
        if (!this.editingAgent) {
            this.toastrService.showWarningToast('No agent selected for update');
            return;
        }

        try {
            const updateAgentRequest: UpdateAgentRecoveryRequest = {
                recoveryId: this.editingAgent.recoveryId,
                isPrimaryRecoveryAgent: this.editIsPrimaryRecoveryAgent
            };

            await this.nationwideService.updateAgentRecoveryJob(updateAgentRequest);

            // Refresh the job data to get the updated assignments
            this.job = await this.nationwideService.getAgentRecoveryJobs(this.job.jobId);

            this.hideEditAgentForm();

            const statusText = this.editIsPrimaryRecoveryAgent ? 'set as primary recovery agent' : 'updated';
            this.toastrService.showSuccessToast(`${this.editingAgent.agentName} has been ${statusText}`);
        } catch (error) {
            console.error('Error updating agent:', error);
            this.toastrService.showErrorToast('Failed to update agent. Please try again.');
        }
    }

    async removeAgent(agent: RecoveryAgentViewModel): Promise<void> {
        try {
            const confirm = this.$mdDialog.confirm()
                .title('Remove Recovery Agent')
                .textContent(`Are you sure you want to remove ${agent.agentName} from this recovery assignment?`)
                .ok('Yes, Remove')
                .cancel('Cancel');

            await this.$mdDialog.show(confirm);

            // Proceed with removal
            await this.nationwideService.removeAgentRecoveryJob(agent.recoveryId);

            // Refresh the job data
            this.job = await this.nationwideService.getAgentRecoveryJobs(this.job.jobId);

            this.toastrService.showSuccessToast(`${agent.agentName} has been removed from the recovery assignment`);
        } catch (error) {
            if (error === undefined) {
                // User cancelled the confirmation dialog
                return;
            }
            console.error('Error removing agent:', error);
            this.toastrService.showErrorToast('Failed to remove agent. Please try again.');
        }
    }

    getAgentCardClass(agent: RecoveryAgentViewModel): string {
        if (agent.primaryRecoveryAgent) {
            return 'primary-recovery';
        }
        return 'additional-recovery';
    }

    getAgentTypeBadge(agent: RecoveryAgentViewModel): string {
        if (agent.primaryRecoveryAgent) {
            return 'Primary Recovery Agent';
        }
        return 'Recovery Agent';
    }

    getAgentCompanyInfo(agent: RecoveryAgentViewModel): string {
        if (agent.primaryRecoveryAgent) {
            return 'Lead Recovery Specialist';
        }
        return 'Recovery Specialist';
    }

    getRankingArray(rating: number): number[] {
        if (!rating) return [];
        return new Array(Math.round(rating));
    }

    getStatusClass(status: string): string {
        const statusMap: { [key: string]: string } = {
            'assigned': 'status-assigned',
            'searching': 'status-searching',
            'pending': 'status-pending',
            'completed': 'status-completed'
        };
        return statusMap[status] || 'status-pending';
    }

    getStatusLabel(status: string): string {
        const labelMap: { [key: string]: string } = {
            'assigned': 'Currently Assigned',
            'searching': 'Currently Searching',
            'pending': 'Pending Assignment',
            'completed': 'Assignment Completed'
        };
        return labelMap[status] || 'Unknown Status';
    }

    getAgentTypeLabel(isPrimary: boolean): string {
        return isPrimary ? 'Primary Recovery Agent' : 'Additional Recovery Agent';
    }

    // Helper method to check if there are any recovery jobs
    hasRecoveryJobs(): boolean {
        return this.job && this.job.recoveryJobs && this.job.recoveryJobs.length > 0;
    }

    // Helper method to get total number of recovery agents
    getTotalRecoveryAgentsCount(): number {
        if (!this.job || !this.job.recoveryJobs) return 0;
        return this.job.recoveryJobs.reduce((total, job) => total + (job.recoveryAgents?.length || 0), 0);
    }

    // Helper method to get the total number of all agents (main + recovery)
    getTotalAgentsCount(): number {
        const mainAgentCount = this.job.assignedAgent ? 1 : 0;
        const recoveryAgentCount = this.getTotalRecoveryAgentsCount();
        return mainAgentCount + recoveryAgentCount;
    }

    async cancel(): Promise<void> {
        const hasUnsavedChanges =
            (this.showAssignForm && (this.selectedAirport || this.selectedAgent || this.isPrimaryRecoveryAgent)) ||
            (this.showEditForm && this.editingAgent);

        if (hasUnsavedChanges) {
            const userConfirmed = this.$window.confirm('You have unsaved changes. Are you sure you want to cancel?');

            if (userConfirmed) {
                this.$mdDialog.cancel();
            }
            // If a user clicks "Cancel" on the confirmation dialog, do nothing
        } else {
            this.$mdDialog.cancel();
        }
    }

    close(): void {
        this.$mdDialog.hide();
    }
}

export default RecoveryAgentManagementController;