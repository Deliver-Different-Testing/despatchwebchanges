/*
 * Angular Fixed Table Header
 * https://github.com/daniel-nagy/fixed-table-header
 * @license MIT
 * v0.2.1
 */
((window, angular, undefined) => {
'use strict';

angular.module('fixed.table.header', []).directive('fixHead', fixHead);

function fixHead($compile, $window) {

  function compile(tElement) {
    const table = {
      clone: tElement.parent().clone().empty(),
      original: tElement.parent()
    };

    const header = {
      clone: tElement.clone(),
      original: tElement
    };

    // prevent recursive compilation
    header.clone.removeAttr('fix-head').removeAttr('ng-if');

    table.clone.css({overflow: 'hidden'}).addClass('clone');
    header.clone.css('display', 'block');
    header.original.css('visibility', 'hidden');

    return scope => {
      const scrollContainer = table.original.parent();

      // insert the element so when it is compiled it will link
      // with the correct scope and controllers
      header.original.after(header.clone);

      $compile(table.clone)(scope);
      $compile(header.clone)(scope);

      scrollContainer.parent()[0].insertBefore(table.clone.append(header.clone)[0], scrollContainer[0]);

      scrollContainer.on('scroll', () => {
        // use CSS transforms to move the cloned header when the table is scrolled horizontally
        header.clone.css('transform', 'translate3d(' + -(scrollContainer.prop('scrollLeft')) + 'px, 0, 0)');
      });

      function cells() {
        return header.clone.find('th').length;
      }

      function getCells(node) {
        return Array.prototype.map.call(node.find('th'), cell => jQLite(cell));
      }

      function height() {
        return header.original.prop('clientHeight');
      }

      function jQLite(node) {
        return angular.element(node);
      }

      function marginTop(height) {
        table.original.css('marginTop', '-' + height + 'px');
      }

      function updateCells() {
        const cells = {
          clone: getCells(header.clone),
          original: getCells(header.original)
        };

        cells.clone.forEach((clone, index) => {
          if(clone.data('isClone')) {
            return;
          }

          // prevent duplicating watch listeners
          clone.data('isClone', true);

          const cell = cells.original[index];
          const style = $window.getComputedStyle(cell[0]);

          const getWidth = () => style.width;

          const setWidth = () => {
            marginTop(height());
            clone.css({minWidth: style.width, maxWidth: style.width});
          };

          const listener = scope.$watch(getWidth, setWidth);

          $window.addEventListener('resize', setWidth);

          clone.on('$destroy', () => {
            listener();
            $window.removeEventListener('resize', setWidth);
          });

          cell.on('$destroy', () => {
            clone.remove();
          });
        });
      }

      scope.$watch(cells, updateCells);

      header.original.on('$destroy', () => {
        header.clone.remove();
      });
    };
  }

  return {
    compile: compile
  };
}

fixHead.$inject = ['$compile', '$window'];

})(window, angular);
