/* 
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Jimmy Zöger and Marcus Wallstersson
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

PeerDash.di.Dim2DVivaldiCoordinate = function() {
    "use strict";
    var logger = new PeerDash.Logger("VIVCOORD", {
        debug: false
    });

    logger.debug("PeerDash.di.Dim2DVivaldiCoordinate instantiated");

    /*
     * Member variables
     */
    var x = 0,
        y = 0;

    /*
     * Private methods
     */

    var distance = function(other) {
        var px = other.x - x;
        var py = other.y - y;
        return Math.sqrt(px * px + py * py);
    };

    var differenceVector = function(other) {
        var vx = x - other.x;
        var vy = y - other.y;
        return new PeerDash.di.Dim2DVivaldiVector(vx, vy);
    };

    var applyForceVector = function(vector, correction_factor, uncertainty_balance) {
        x += vector.x() * correction_factor * uncertainty_balance;
        y += vector.y() * correction_factor * uncertainty_balance;
    };

    /*
     * The returned object containing public attributes and methods
     */
    return {
        coord: function() {
            return {
                x: x,
                y: y
            };
        },
        distance: distance,
        differenceVector: differenceVector,
        applyForceVector: applyForceVector,
        distanceBetweenTwoCoordinates: function(c1, c2) {
            var px = c1.x - c2.x;
            var py = c1.y - c2.y;
            return Math.sqrt(px * px + py * py);
        }
    };
};

PeerDash.di.Dim2DVivaldiCoordinate.prototype = {
    constructor: PeerDash.di.Dim2DVivaldiCoordinate
};
