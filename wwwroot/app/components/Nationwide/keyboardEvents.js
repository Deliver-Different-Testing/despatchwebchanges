/**
 * @file keyboardEvents.js
 * @description These scripts lived in nationwideView.html.
 */

/**
 * Handles keyboard events for the entire document.
 */
(() => {
    const keyIsDown = {};

    /**
     * Overrides keyboard events to prevent default behavior and handle custom actions.
     * @param {KeyboardEvent} e - The keyboard event object.
     * @returns {boolean} False if the event is prevented, undefined otherwise.
     */
    const overrideKeyboardEvent = (e) => {
        if (e.type === "keydown" && !keyIsDown[e.code]) {
            keyIsDown[e.code] = true;
            handleKeyDown(e);
        } else if (e.type === "keyup") {
            delete keyIsDown[e.code];
        }

        if (e.code === "KeyD" && e.ctrlKey) {
            e.preventDefault();
            return false;
        }
    };

    /**
     * Handles specific key down events.
     * @param {KeyboardEvent} e - The keyboard event object.
     */
    const handleKeyDown = (e) => {
        if (e.code === "F2") {
            showSMSForm();
        }
    };

    document.addEventListener("keydown", overrideKeyboardEvent);
    document.addEventListener("keyup", overrideKeyboardEvent);
})();

/**
 * Handles click and drag functionality for table rows.
 */
(() => {
    let isMouseDown = false;

    /**
     * Handles mouse down events on clickable rows.
     * @param {MouseEvent} event - The mouse event object.
     */
    const handleMouseDown = (event) => {
        isMouseDown = true;
        const $row = angular.element(event.currentTarget);

        if (event.ctrlKey) {
            $row.toggleClass("active");
        } else {
            setActiveRow($row);
        }

        angular.element(".activeTable").removeClass("activeTable");
        $row.closest(".table").addClass("activeTable");

        if (!event.ctrlKey && $row.hasClass("draggable-row")) {
            handleDraggableRow($row, event);
        }
    };

    /**
     * Sets the active row in the table.
     * @param {JQLite} $row - The jQuery/jqLite wrapped row element.
     */
    const setActiveRow = ($row) => {
        if (!$row.hasClass("active")) {
            const group = $row.parents(".table-rows").attr("data-group");
            angular.element(`*[data-group="${group}"]`).find(".active").removeClass("active");
            $row.addClass("active");
        }
    };

    /**
     * Handles draggable row functionality.
     * @param {JQLite} $row - The jQuery/jqLite wrapped row element.
     * @param {MouseEvent} event - The mouse event object.
     */
    const handleDraggableRow = ($row, event) => {
        setTimeout(() => {
            if (isMouseDown) {
                const activeRows = angular.element(".activeTable .clickable-row.active");
                const jobNo = activeRows.length > 1 ? `${activeRows.length} Jobs` : $row.attr("data-jobno");

                angular.element("#draggingItems")
                    .show()
                    .html(jobNo)
                    .css({top: event.pageY - 25, left: event.pageX - 50})
                    .draggable()
                    .trigger(event);
            }
        }, 200);
    };

    /**
     * Handles mouse up events on clickable rows.
     * @param {MouseEvent} event - The mouse event object.
     */
    const handleMouseUp = (event) => {
        isMouseDown = false;
        if (event.which === 3) {
            angular.element(".rightActiveTable").removeClass("rightActiveTable");
            angular.element(event.currentTarget).closest(".table").addClass("rightActiveTable");
        }
        if (!event.ctrlKey) {
            setActiveRow(angular.element(event.currentTarget));
        }
    };

    angular.element(document).on("mousedown", ".clickable-row", handleMouseDown);
    angular.element(document).on("mouseup", ".clickable-row", handleMouseUp);
    angular.element(document).on("mouseup", () => {
        angular.element("#draggingItems").hide();
        isMouseDown = false;
    });
})();

/**
 * Handles keyboard navigation for table rows.
 */
angular.element(document).on("keydown", (e) => {
    const code = e.key;
    const $active = angular.element(".activeTable").find(".active");
    if (code === "ArrowDown") {
        $active.removeClass("active").next().addClass("active").mouseup().click();
    } else if (code === "ArrowUp") {
        $active.removeClass("active").prev().addClass("active").mouseup().click();
    }
});

/**
 * Resizes table headers to match the width of table body cells.
 */
const sizeHeadings = () => {
    angular.element("body").find(".box").each(function () {
        const $box = angular.element(this);
        $box.find(".table-headings thead tr th").each((index, element) => {
            const newWidth = $box.find(".table tbody tr td").eq(index).outerWidth();
            angular.element(element).outerWidth(newWidth);
        });
        $box.find(".table-headings table").width($box.find(".table").width());
    });

    const height = angular.element("#box-clearLists").find(".box-content").height() - 30;
    angular.element(".clearLists-list").each(function () {
        const newHeight = angular.element(this).data("height") * height / 100;
        angular.element(this).height(newHeight);
    });
};

/**
 * Initializes the page by setting the favicon and sizing the headings.
 */
const initialize = () => {
    document.getElementById("favicon").setAttribute("href", "/Nationwide.ico");
    sizeHeadings();
};

// Initialize when the document is ready
angular.element(document).on("ready", initialize);
