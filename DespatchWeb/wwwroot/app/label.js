// Define the overlay, derived from google.maps.OverlayView
function Label(opt_options) {
    // Initialization
    this.setValues(opt_options);

    // Label specific
    const span = this.span_ = document.createElement('span');
    span.className = 'marker ' + this.cssClass;

    const div = this.div_ = document.createElement('div');
    div.appendChild(span);
    div.style.cssText = 'position: absolute; display: none; border 1px solid red;';
}
Label.prototype = new google.maps.OverlayView;

Label.prototype.setVisible = function (visible) {
    const div = this.div_;
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


// Implement onAdd
Label.prototype.onAdd = function () {
    const pane = this.getPanes().overlayLayer;
    pane.appendChild(this.div_);

    // Ensures the label is redrawn if the text or position is changed.
    const me = this;

    this.listeners_ = [
        google.maps.event.addListener(this, 'position_changed',
            function () { me.draw(); }),
        google.maps.event.addListener(this, 'text_changed',
            function () { me.draw(); })
    ];


};

// Implement onRemove
Label.prototype.onRemove = function () {
    if (this.div_.parentNode === null) {
        this.div_ = null;
        return false;
    }

    this.div_.parentNode.removeChild(this.div_);

    // Label is removed from the map, stop updating its position/text.
    let i = 0;
    const I = this.listeners_.length;
    for (; i < I; ++i) {
        google.maps.event.removeListener(this.listeners_[i]);
    }
    return true;
};

// Implement draw
Label.prototype.draw = function () {
    const projection = this.getProjection();
    const position = projection.fromLatLngToDivPixel(this.get('position'));

    const div = this.div_;
    div.style.left = position.x + 'px';
    div.style.top = position.y + 'px';
    //div.style.display = 'block';
    if (this.isVisible)
        div.style.display = 'block';
    else
        div.style.display = 'none';
    const clickable = this.get('clickable');
    this.span_.style.cursor = clickable ? 'pointer' : '';


    this.span_.innerHTML = this.get('text').toString();
};
