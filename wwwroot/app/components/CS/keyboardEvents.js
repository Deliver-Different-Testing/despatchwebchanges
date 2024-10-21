/**
 * @file keyboardEvents.js
 * @description Main script for handling keyboard events, mouse interactions, and UI updates.
 */

(() => {
    /**
     * @type {Object.<number, boolean>}
     */
    const keyIsDown = {};

    /**
     * Overrides keyboard events to handle specific key combinations.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    const overrideKeyboardEvent = (e) => {
        switch (e.type) {
            case "keydown":
                if (!keyIsDown[e.keyCode]) {
                    keyIsDown[e.keyCode] = true;
                    // Key down specific logic here
                    if (e.keyCode === 82 && e.ctrlKey) {
                        // Commented out: location.reload();
                    }
                }
                break;
            case "keyup":
                delete keyIsDown[e.keyCode];
                // Key up specific logic here
                break;
        }
        disabledEventPropagation(e);
        if ((e.keyCode === 68 || e.keyCode === 65) && e.ctrlKey) {
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

    /**
     * Sizes table headings to match the corresponding table body columns.
     */
    const sizeHeadings = () => {
        angular.element("body").find(".box").each(function () {
            const box = angular.element(this);
            box.find(".table-headings thead tr th").each((index, element) => {
                const newWidth = box.find(".table tbody tr td:visible").eq(index).width();
                angular.element(element).width(newWidth);
            });
            box.find(".table-headings table").width(box.find(".table").width());
        });

        angular.element("body").find(".box").each(function () {
            const box = angular.element(this);
            box.find(".table-b-headings thead tr th").each((index, element) => {
                const newWidth = box.find(".table tbody tr td:visible").eq(index).width();
                angular.element(element).width(newWidth);
            });
            box.find(".table-b-headings table").width(box.find(".table").width());
        });
    };

    // Event listeners
    document.onkeydown = overrideKeyboardEvent;
    document.onkeyup = overrideKeyboardEvent;

    angular.element(document).on('focus', '.searchBox input', () => {
        angular.element(".results").fadeIn(100);
    });

    angular.element(document).on('blur', '.searchBox input', () => {
        angular.element(".results").fadeOut(100);
    });

    angular.element(document).on('click', '.top-bar .btn-group .btn', function () {
        angular.element(this).parent().find('.topBarActive').removeClass('topBarActive');
        angular.element(this).addClass('topBarActive');
    });

    angular.element(document).ready(() => {
        const favicon = document.getElementById("favicon");
        favicon.setAttribute("href", "/POD_favicon.ico");

        let isDown = false;
        let isOnRow = false;

        angular.element(document)
            .mousedown(() => {
                isDown = true;
            })
            .mouseup(() => {
                isDown = false;
            });

        angular.element(document).on("mouseenter", ".activeTable .clickable-row", (event) => {
            if (event.ctrlKey && isDown) {
                angular.element(event.currentTarget).addClass("active");
            }
        });

        angular.element(document).on("hover", ".activeTable .clickable-row", () => {
            isOnRow = true;
        });

        angular.element(document).on("mouseleave", ".activeTable .clickable-row", () => {
            isOnRow = false;
        });

        angular.element(document).on('click', '.box-content', (event) => {
            event.stopPropagation();
            if (isOnRow) {
                angular.element(".activeTable .active").removeClass("active");
            }
        });
    });

    let mouseDown = 0;

    angular.element(document).on('mousedown', '.clickable-row', function (event) {
        let group;
        const jobNo = angular.element(".activeTable .clickable-row.active").length > 1
            ? `${angular.element(".activeTable .clickable-row.active").length} Jobs`
            : angular.element(this).attr("data-jobno");

        if (mouseDown === 0) {
            mouseDown = 1;

            if (event.which === 1) {
                if (event.ctrlKey) {
                    angular.element(this).toggleClass('active');
                } else if (!angular.element(this).hasClass("active")) {
                    group = angular.element(this).parents(".table-rows").attr("data-group");
                    angular.element(`*[data-group="${group}"]`).each(function () {
                        angular.element(this).find('.active').removeClass('active');
                    });
                    angular.element(this).addClass('active');
                }

                angular.element(".activeTable").removeClass("activeTable");
                angular.element(this).parents(".table").addClass("activeTable");
            }

            if (!event.ctrlKey && angular.element(this).hasClass("draggable-row")) {
                if (!angular.element(this).hasClass("active")) {
                    group = angular.element(this).parents(".table-rows").attr("data-group");
                    angular.element(`*[data-group="${group}"]`).each(function () {
                        angular.element(this).find('.active').removeClass('active');
                    });
                    angular.element(this).addClass('active');
                }
                setTimeout(() => {
                    if (mouseDown === 1) {
                        const $draggingItems = angular.element("#draggingItems");
                        $draggingItems.show().html(jobNo).css({
                            top: event.pageY - 25,
                            left: event.pageX - 50
                        }).draggable().trigger(event);
                    }
                }, 200);
            }
        }
    });

    angular.element(document).on('mouseup', '.clickable-row', function (event) {
        if (event.which === 3) {
            angular.element(".rightActiveTable").removeClass("rightActiveTable");
            angular.element(this).parents(".table").addClass("rightActiveTable");
        }
        if (!event.ctrlKey && !angular.element(this).hasClass("active")) {
            const group = angular.element(this).parents(".table-rows").attr("data-group");
            angular.element(`*[data-group="${group}"]`).each(function () {
                angular.element(this).find('.active').removeClass('active');
            });
            angular.element(this).addClass('active');
        }
    });

    angular.element(document).on('click', '.clickable-row', (event) => {
        event.stopPropagation();
    });

    angular.element(document).on("mouseup", () => {
        angular.element("#draggingItems").hide();
        mouseDown = 0;
    });

    angular.element(document).on("keydown", (e) => {
        const code = e.keyCode || e.which;
        if (code === 40) {
            angular.element(".activeTable").find(".active").removeClass("active").next().addClass("active").mouseup().click();
        } else if (code === 38) {
            angular.element(".activeTable").find(".active").removeClass("active").prev().addClass("active").mouseup().click();
        }
    });
})();
