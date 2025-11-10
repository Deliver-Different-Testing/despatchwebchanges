// Define the overlay, derived from google.maps.OverlayView
// Lazy initialization pattern - prototype is set up on first use when google.maps is available

(function(window) {
    'use strict';

    var isPrototypeInitialized = false;

    function Label(opt_options) {
        // Lazy initialize the prototype on first instantiation
        if (!isPrototypeInitialized) {
            if (typeof google === 'undefined' || !google.maps || !google.maps.OverlayView) {
                throw new Error('Google Maps API must be loaded before creating Label overlays');
            }

            // Properly extend google.maps.OverlayView
            Label.prototype = Object.create(google.maps.OverlayView.prototype);
            Label.prototype.constructor = Label;

            // Add all prototype methods
            Label.prototype.setVisible = function (visible) {
                var div = this.div_;
                if (div === null) return;
                if (visible) {
                    div.style.display = 'block';
                    this.isVisible = true;
                }
                else {
                    div.style.display = 'none';
                    this.isVisible = false;
                }
            };

            Label.prototype.onAdd = function () {
                var pane = this.getPanes().overlayLayer;
                pane.appendChild(this.div_);

                var me = this;
                this.listeners_ = [
                    google.maps.event.addListener(this, 'position_changed', function () { me.draw(); }),
                    google.maps.event.addListener(this, 'text_changed', function () { me.draw(); })
                ];
            };

            Label.prototype.onRemove = function () {
                if (this.div_.parentNode === null) {
                    this.div_ = null;
                    return false;
                }

                this.div_.parentNode.removeChild(this.div_);

                for (var i = 0, I = this.listeners_.length; i < I; ++i) {
                    google.maps.event.removeListener(this.listeners_[i]);
                }
                return true;
            };

            Label.prototype.draw = function () {
                var projection = this.getProjection();
                var position = projection.fromLatLngToDivPixel(this.get('position'));

                var div = this.div_;
                div.style.left = position.x + 'px';
                div.style.top = position.y + 'px';

                if (this.isVisible)
                    div.style.display = 'block';
                else
                    div.style.display = 'none';

                var clickable = this.get('clickable');
                this.span_.style.cursor = clickable ? 'pointer' : '';

                this.span_.innerHTML = this.get('text').toString();
            };

            isPrototypeInitialized = true;
        }

        // Now that prototype is set up, initialize the instance
        google.maps.OverlayView.call(this);
        this.setValues(opt_options);

        // Label specific properties
        var span = this.span_ = document.createElement('span');
        span.className = 'marker ' + this.cssClass;

        var div = this.div_ = document.createElement('div');
        div.appendChild(span);
        div.style.cssText = 'position: absolute; display: none;';
    }

    // Export to global scope
    window.Label = Label;

})(window);
