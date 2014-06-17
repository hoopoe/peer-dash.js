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

PeerDash.di.Dim2DVivaldiVector = function(_x, _y) {
    "use strict";
    var logger = new PeerDash.Logger("VIVVECT", {
        debug: false
    });

    logger.debug("PeerDash.di.Dim2DVivaldiVector instantiated");

    /*
     * Member variables
     */
    var x = _x,
        y = _y;

    /*
     * Private methods
     */

    var vectorLength = function() {
        return Math.sqrt(x * x + y * y);
    };

    var normalize = function() {
        var length = vectorLength();
        // Nodes start at origo and thus the length could be 0, in this case a random vector is generated.
        if (length === 0) {
            x = Math.random();
            y = Math.random();
            length = vectorLength();
        }
        x /= length;
        y /= length;
    };

    var applyError = function(error) {
        x *= error;
        y *= error;
    };

    /*
     * The returned object containing public attributes and methods
     */
    return {
        x: function() {
            return x;
        },
        y: function() {
            return y;
        },
        components: function() {
            return {
                x: x,
                y: y
            };
        },
        normalize: normalize,
        applyError: applyError
    };
};

PeerDash.di.Dim2DVivaldiVector.prototype = {
    constructor: PeerDash.di.Dim2DVivaldiVector
};
