/*!
 The MIT License

 Copyright (c) 2024 Kerran Tetley

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */

/*
 Example config:

 config = {
    center: { lat: 39.8097343, lng: -98.5556199 },
    zoom: 5,
    job: {
        id: 67,
        pickup: { lat: 40.7128, lng: -74.0060 },
        delivery: { lat: 46.7128, lng: -71.0060 },
        childJobs: [
            {
                id: 68,
                pickup: { lat: 40.7128, lng: -74.0060 },
                delivery: { lat: 42.7128, lng: -73.0060 },
                flight: false
            },
            {
                id: 69,
                pickup: { lat: 42.7128, lng: -73.0060 },
                delivery: { lat: 45.7128, lng: -72.0060 },
                flight: true
            },
            {
                id: 70,
                pickup: { lat: 45.7128, lng: -72.0060 },
                delivery: { lat: 46.7128, lng: -71.0060 },
                flight: false
            }
        ],
        selectedJobIndex: 1, //e.g. parent is index 0, children are 1, 2, 3 in order
        courierLocation: { lat: 39.8097343, lng: -98.5556199 }
    }
 }
*/

angular.module('hereMapTracking', [
    'hereMapTracking.services',
    'hereMapTracking.components'
]);

// Make sure to declare these modules separately
angular.module('hereMapTracking.services', []);
angular.module('hereMapTracking.components', []);