angular.module('uDispatch')
    .directive('autoResizeTable',
        ['$timeout', '$window', ($timeout, $window) => ({
            restrict: 'A',
            link: (scope, element, attrs) => {
                function resizeTable() {
                    $timeout(() => {
                        const table = element[0];
                        const rows = table.getElementsByTagName('tr');
                        const columnWidths = [];

                        // Calculate the maximum width for each column
                        for (let i = 0; i < rows.length; i++) {
                            const cells = rows[i].getElementsByTagName('td').length > 0 ?
                                rows[i].getElementsByTagName('td') :
                                rows[i].getElementsByTagName('th');
                            for (let j = 0; j < cells.length; j++) {
                                const cellWidth = cells[j].offsetWidth;
                                if (!columnWidths[j] || cellWidth > columnWidths[j]) {
                                    columnWidths[j] = cellWidth;
                                }
                            }
                        }

                        // Set the width for each column
                        const headerCells = table.getElementsByTagName('th');
                        for (let k = 0; k < headerCells.length; k++) {
                            headerCells[k].style.width = columnWidths[k] + 'px';
                        }
                    });
                }

                // Initial resize
                resizeTable();

                // Listen for the 'autoResizeTable' event
                scope.$on('autoResizeTable', () => {
                    resizeTable();
                });

                // Resize on window resize
                $window.addEventListener('resize', resizeTable);

                // Clean up the window resize listener when the scope is destroyed
                scope.$on('$destroy', () => {
                    $window.removeEventListener('resize', resizeTable);
                });
            }
        })]);
