import {bindAllMethods} from "../bindAllMethods";

class BaseController implements angular.IController {
    constructor() {
        bindAllMethods(this);
    }
}
export default BaseController;
