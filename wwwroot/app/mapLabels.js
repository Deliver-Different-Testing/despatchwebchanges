/**
 * @fileoverview Custom Google Maps overlay for labels and initialization functions
 */

/**
 * Custom Label class extending google.maps.OverlayView
 * @class
 * @extends google.maps.OverlayView
 */
class Label extends google.maps.OverlayView {
    /**
     * Create a Label
     * @param {Object} [options={}] - The label options
     */
    constructor(options = {}) {
        super();
        this.setValues(options);

        this.span = document.createElement('span');
        this.span.className = 'marker ' + (this.cssClass || '');

        this.div = document.createElement('div');
        this.div.appendChild(this.span);
        this.div.style.cssText = 'position: absolute; display: none; border: 1px solid red;';
    }

    /**
     * Set the visibility of the label
     * @param {boolean} visible - Whether the label should be visible
     */
    setVisible(visible) {
        if (this.div) {
            this.div.style.display = visible ? 'block' : 'none';
            this.isVisible = visible;
        }
    }

    /**
     * Called when the label is added to the map
     * Implements OverlayView interface
     */
    onAdd() {
        const pane = this.getPanes().overlayLayer;
        pane.appendChild(this.div);

        this.listeners = [
            google.maps.event.addListener(this, 'position_changed', () => this.draw()),
            google.maps.event.addListener(this, 'text_changed', () => this.draw())
        ];
    }

    /**
     * Called when the label is removed from the map
     * Implements OverlayView interface
     * @returns {boolean} True if the div was removed, false otherwise
     */
    onRemove() {
        if (this.div && this.div.parentNode) {
            this.div.parentNode.removeChild(this.div);
            this.listeners.forEach(listener => google.maps.event.removeListener(listener));
            return true;
        }
        return false;
    }

    /**
     * Called when the label needs to be redrawn
     * Implements OverlayView interface
     */
    draw() {
        const projection = this.getProjection();
        const position = projection.fromLatLngToDivPixel(this.get('position'));

        this.div.style.left = `${position.x}px`;
        this.div.style.top = `${position.y}px`;
        this.div.style.display = this.isVisible ? 'block' : 'none';

        const clickable = this.get('clickable');
        this.span.style.cursor = clickable ? 'pointer' : '';
        this.span.innerHTML = this.get('text').toString();
    }
}

/**
 * Initialize the Google Map
 * This function is called when the Google Maps API is loaded
 */
function initMap() {
    console.log("Maps Loaded");
}


