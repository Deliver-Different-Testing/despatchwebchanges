// Define the Label class, derived from google.maps.OverlayView
// This code was moved from _Layout.cshtml
class Label extends google.maps.OverlayView {
    constructor(options = {}) {
        super();
        this.setValues(options);

        this.span = document.createElement('span');
        this.span.className = 'marker ' + (this.cssClass || '');

        this.div = document.createElement('div');
        this.div.appendChild(this.span);
        this.div.style.cssText = 'position: absolute; display: none; border: 1px solid red;';
    }

    setVisible(visible) {
        if (this.div) {
            this.div.style.display = visible ? 'block' : 'none';
            this.isVisible = visible;
        }
    }

    onAdd() {
        const pane = this.getPanes().overlayLayer;
        pane.appendChild(this.div);

        this.listeners = [
            google.maps.event.addListener(this, 'position_changed', () => this.draw()),
            google.maps.event.addListener(this, 'text_changed', () => this.draw())
        ];
    }

    onRemove() {
        if (this.div && this.div.parentNode) {
            this.div.parentNode.removeChild(this.div);
            this.listeners.forEach(listener => google.maps.event.removeListener(listener));
            return true;
        }
        return false;
    }

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

function initMap() {
    console.log("Maps Loaded");
}

// Raygun initialization
rg4js('apiKey', 'iAbyCH3AlUySXlZxGuH0HQ');
rg4js('enableCrashReporting', true);
