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

Array.prototype.random = function(num) {
    if (num > this.length) num = this.length;
    var randoms = new Array(num);
    for (var i = 0; i < num; i++) {
        var rndIndex = i + Math.floor(Math.random() * (this.length - i));
        var tmp = this[i];
        this[i] = this[rndIndex];
        this[rndIndex] = tmp;
        randoms[i] = this[i];
    }
    return randoms;
};

Array.prototype.randomSplice = function(num) {
    if (num > this.length) num = this.length;
    var randoms = new Array(num);
    for (var i = 0; i < num; i++) {
        var rndIndex = Math.floor(Math.random() * (this.length - i));
        randoms[i] = this.splice(rndIndex, 1)[0];
    }
    return randoms;
};

Array.prototype.remove = function(value) {
    var idx = this.indexOf(value);
    if (idx != -1) {
        return this.splice(idx, 1)[0];
    }
    return false;
};
