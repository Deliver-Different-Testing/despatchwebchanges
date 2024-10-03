angular.module('uDispatch')
    .service('NationwideLayoutService', ['$window', '$mdDialog', ($window, $mdDialog) => {
        // Column width options
        const COL_WIDTH_LARGE = "35%";
        const COL_WIDTH_MEDIUM = "30%";

        // Box height options
        const BOX_HEIGHT_LARGE = "60%";
        const BOX_HEIGHT_MEDIUM = "50%";
        const BOX_HEIGHT_SMALL = "40%";
        const BOX_HEIGHT_XSMALL = "30%";

        // Define individual boxes
        const jobsListBox = {name: "jobsList", height: BOX_HEIGHT_LARGE};
        const jobsListPODBox = {name: "jobsListPOD", height: BOX_HEIGHT_SMALL};
        const jobsListDeliveryBox = {name: "jobsListDelivery", height: BOX_HEIGHT_MEDIUM};
        const jobsListRepriceBox = {name: "jobsListReprice", height: BOX_HEIGHT_MEDIUM};
        const flightDataTableBox = {name: "flightDataTable", height: BOX_HEIGHT_MEDIUM};
        const jobDetailBox = {name: "jobDetail", height: BOX_HEIGHT_MEDIUM};


        // Disabled for now. Will switch out with flight data table
        //  const mapBox = {name: "map", height: BOX_HEIGHT_MEDIUM};

        // Define columns
        const column1 = {
            id: "col1", width: COL_WIDTH_LARGE, boxes: [jobsListBox, jobsListPODBox]
        };

        const column2 = {
            id: "col2", width: COL_WIDTH_LARGE, boxes: [jobsListDeliveryBox, jobsListRepriceBox]
        };

        const column3 = {
            id: "col3", width: COL_WIDTH_MEDIUM, boxes: [jobDetailBox, flightDataTableBox]
        };

        // Construct the layout
        const defaultLayout = [{
            name: "Default", layout: {
                columns: [column1, column2, column3]
            }
        }];

        let currentLayouts = null;
        let layoutsObject = null;
        let mapZoom = {display: true};
        let currentLayoutName = "default";

        const init = () => {
            if ($window.Modernizr && $window.Modernizr.localstorage) {
                const storedLayouts = $window.localStorage.getItem(`layoutsNW-${$window.ContactID}`);
                const storedMapZoom = $window.localStorage.getItem(`mapZoomNW-${$window.ContactID}`);

                if (storedLayouts) {
                    currentLayouts = JSON.parse(storedLayouts);
                    currentLayouts[0] = defaultLayout[0]; // Always use the latest default layout
                }

                if (storedMapZoom) {
                    mapZoom = JSON.parse(storedMapZoom);
                }
            }

            if (!currentLayouts) {
                currentLayouts = defaultLayout;
            }
        };


        init();

        const setLastActiveLayoutName = (layoutName) => {
            if ($window.Modernizr && $window.Modernizr.localstorage) {
                $window.localStorage.setItem(`lastActiveLayoutNW-${$window.ContactID}`, layoutName);
            }
        };

        return {
            getDefaultLayout: () => angular.copy(defaultLayout),

            getLayouts: () => angular.copy(currentLayouts),

            getCurrentLayout: () => angular.copy(currentLayouts[0].layout),

            getMapZoom: () => angular.copy(mapZoom),

            setMapZoom: (newMapZoom) => {
                mapZoom = newMapZoom;
                if ($window.Modernizr && $window.Modernizr.localstorage) {
                    $window.localStorage.setItem(`mapZoomNW-${$window.ContactID}`, JSON.stringify(mapZoom));
                }
            },

            getUserName: () => $window.FirstName,

            updateLayouts: (newLayouts) => {
                currentLayouts = newLayouts;
                if ($window.Modernizr && $window.Modernizr.localstorage) {
                    $window.localStorage.setItem(`mapZoomNW-${$window.ContactID}`, JSON.stringify(currentLayouts));
                }
            },

            deleteLayout: async (index) => {
                const deleteConfirm = $mdDialog.confirm()
                    .title('Delete Layout?')
                    .textContent('Are you sure you would like to delete this layout?')
                    .ariaLabel('delete layout')
                    .ok('Delete')
                    .cancel('Cancel');

                try {
                    await $mdDialog.show(deleteConfirm);

                    layoutsObject.splice(index, 1);
                    if ($window.Modernizr && $window.Modernizr.localstorage) {
                        $window.localStorage.setItem(`layoutsNW-${$window.ContactID}`, JSON.stringify(layoutsObject));
                    }
                } catch (error) {
                    console.log("Delete layout canceled!");
                }
            },

            setLastActiveLayoutName: setLastActiveLayoutName,

            loadLayout: (index) => {
                currentLayoutName = layoutsObject[index].name;
                const loadedLayout = angular.copy(layoutsObject[index].layout);

                setLastActiveLayoutName(currentLayoutName);

                return {
                    name: currentLayoutName, layout: loadedLayout
                };
            },

            saveLayout: async (currentLayout) => {
                const saveLayoutPrompt = $mdDialog.prompt()
                    .title('Save Layout')
                    .textContent('Please enter a name for this layout.')
                    .ariaLabel('Layout name')
                    .required(true)
                    .ok('Save')
                    .cancel('Cancel');

                try {
                    const layoutName = await $mdDialog.show(saveLayoutPrompt);

                    if ($window.Modernizr && $window.Modernizr.localstorage) {
                        layoutsObject = layoutsObject.concat({
                            name: layoutName, layout: angular.copy(currentLayout)
                        });

                        $window.localStorage.setItem(`layoutsNW-${$window.ContactID}`, JSON.stringify(layoutsObject));

                        setLastActiveLayoutName(layoutName);
                    }

                    return {data: "OK", name: layoutName};
                } catch (error) {
                    console.log("Save Layout Cancelled!");
                    throw error;
                }
            },

            getCurrentLayoutName: () => currentLayoutName
        };
    }]);
