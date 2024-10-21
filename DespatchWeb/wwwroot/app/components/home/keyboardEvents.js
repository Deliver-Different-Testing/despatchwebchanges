/**
 * @file keyboardEvents.js
 * @description Handles keyboard events and DOM interactions for a web application.
 */

/**
 * Set to keep track of which keys are currently pressed down.
 * @type {Set<number>}
 */
const keyIsDown = new Set();

/**
 * Overrides default keyboard event behavior.
 * @param {KeyboardEvent} e - The keyboard event.
 * @returns {boolean} False if the event is prevented, undefined otherwise.
 */
const overrideKeyboardEvent = (e) => {
    if (e.type === "keydown") {
        keyIsDown.add(e.keyCode);
    } else if (e.type === "keyup") {
        keyIsDown.delete(e.keyCode);
    }

    disabledEventPropagation(e);
    if (e.keyCode === 68 && e.ctrlKey) {
        e.preventDefault();
        return false;
    }
};

/**
 * Disables event propagation for specific key combinations.
 * @param {KeyboardEvent} e - The keyboard event.
 */
const disabledEventPropagation = (e) => {
    if (e.keyCode === 68 && e.ctrlKey) {
        if (e.stopPropagation) {
            e.stopPropagation();
        } else if (window.event) {
            window.event.cancelBubble = true;
        }
    }
};

document.onkeydown = overrideKeyboardEvent;
document.onkeyup = overrideKeyboardEvent;

/**
 * Handles left-click behavior on clickable rows.
 * @param {angular.IAugmentedJQuery} $element - The clicked element.
 * @param {MouseEvent} event - The mouse event.
 */
const handleLeftClick = ($element, event) => {
    if (event.ctrlKey) {
        $element.toggleClass('active');
    } else if (!$element.hasClass("active")) {
        const group = $element.parents(".table-rows").attr("data-group");
        angular.element(`*[data-group="${group}"]`).each(function () {
            angular.element(this).find('.active').removeClass('active');
        });
        $element.addClass('active');
    }
    angular.element(".activeTable").removeClass("activeTable");
    $element.parents(".table").addClass("activeTable");
};

/**
 * Handles draggable row behavior.
 * @param {angular.IAugmentedJQuery} $element - The draggable element.
 * @param {MouseEvent} event - The mouse event.
 * @param {string} jobNo - The job number or count.
 */
const handleDraggableRow = ($element, event, jobNo) => {
    if (!$element.hasClass("active")) {
        const group = $element.parents(".table-rows").attr("data-group");
        angular.element(`*[data-group="${group}"]`).each(function () {
            angular.element(this).find('.active').removeClass('active');
        });
        $element.addClass('active');
    }
    setTimeout(() => {
        if (mouseDown === 1) {
            angular.element("#draggingItems").show().html(jobNo)
                .css({"top": event.pageY - 25, "left": event.pageX - 50})
                .draggable().trigger(event);
        }
    }, 200);
};

// Event listeners
let isDown = false;
let mouseDown = 0;

/**
 * Sets up event listeners when the document is ready.
 */
angular.element(document).ready(() => {
    const $document = angular.element(document);

    $document
        .on('mousedown', () => {
            isDown = true;
        })
        .on('mouseup', () => {
            isDown = false;
        });

    $document.on("mouseenter", ".activeTable .clickable-row", (event) => {
        if (event.ctrlKey && isDown) {
            const $this = angular.element(event.currentTarget);
            $this.addClass("active");
            $this.siblings(".test").trigger('click');
        }
    });

    $document.on('mousedown', '.clickable-row', (event) => {
        const $this = angular.element(event.currentTarget);
        const $activeRows = angular.element(".activeTable .clickable-row.active");
        const jobNo = $activeRows.length > 1 ? `${$activeRows.length} Jobs` : $this.attr("data-jobno");

        if (mouseDown === 0) {
            mouseDown = 1;
            if (event.which === 1) {
                handleLeftClick($this, event);
            }
            if (!event.ctrlKey && $this.hasClass("draggable-row")) {
                handleDraggableRow($this, event, jobNo);
            }
        }
    });

    $document.on('mouseup', '.clickable-row', (event) => {
        const $this = angular.element(event.currentTarget);
        if (event.which === 3) {
            angular.element(".rightActiveTable").removeClass("rightActiveTable");
            $this.parents(".table").addClass("rightActiveTable");
        }
        if (!event.ctrlKey && !$this.hasClass("active")) {
            const group = $this.parents(".table-rows").attr("data-group");
            angular.element(`*[data-group="${group}"]`).each(function () {
                angular.element(this).find('.active').removeClass('active');
            });
            $this.addClass('active');
        }
    });

    $document.on("mouseup", () => {
        angular.element("#draggingItems").hide();
        mouseDown = 0;
    });

    $document.on("keydown", (e) => {
        const code = e.keyCode || e.which;
        const $activeTable = angular.element(".activeTable");
        const $active = $activeTable.find(".active");
        if (code === 40) {
            $active.removeClass("active").next().addClass("active").triggerHandler('mouseup').trigger('click');
        } else if (code === 38) {
            $active.removeClass("active").prev().addClass("active").triggerHandler('mouseup').trigger('click');
        }
    });
});

// Other event listeners
angular.element(document).on('keydown', '.dispatchField, .lateCallField', (event) => {
    if (event.keyCode === 13) {
        angular.element(event.currentTarget).parents(".clickable-row").addClass("doing");
    }
});

angular.element(document).on('click', '.top-bar .btn-group .btn', (event) => {
    const $this = angular.element(event.currentTarget);
    if (!event.ctrlKey && !event.metaKey) {
        $this.parent().find('.topBarActive').removeClass('topBarActive');
    }
    $this.addClass('topBarActive');
});

angular.element(document).on('click', '.driverLocations-list-title', (event) => {
    const $this = angular.element(event.currentTarget);
    if (!event.ctrlKey && !event.metaKey) {
        angular.element("#driverLocations").find('.listActive').removeClass('listActive');
    }
    $this.addClass('listActive');
});

/**
 * Adjusts the size of table headings and driver location lists.
 * @global
 */
window.sizeHeadings = () => {
    angular.element("body").find(".box").each(function () {
        const $box = angular.element(this);
        $box.find(".table-headings thead tr th").each((index, element) => {
            const newWidth = $box.find(".table tbody tr td").eq(index).outerWidth();
            angular.element(element).outerWidth(newWidth);
        });
        $box.find(".table-headings table").width($box.find(".table").width());
    });

    const height = angular.element("#box-driverLocations").find(".box-content").height() - 30;
    angular.element(".driverLocations-list").each(function () {
        const $this = angular.element(this);
        const newHeight = $this.data("height") * height / 100;
        $this.height(newHeight);
    });
};
