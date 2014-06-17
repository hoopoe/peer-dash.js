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

var ExpireMap = function(initObject) {

    this._map = {};

    this._defaultTimeout = 60 * 1000;

    if (initObject !== undefined && initObject.defaultTimeout !== undefined) {
        this._defaultTimeout = initObject.defaultTimeout;
    }
};

ExpireMap.prototype.get = function(key) {
    return this._map[key];
};

ExpireMap.prototype.put = function(key, value, timeout, callback) {
    var map = this._map;

    map[key] = value;

    if (typeof(timeout) == 'function') {
        callback = timeout;
        timeout = undefined;
    }

    if (timeout === undefined) {
        timeout = this._defaultTimeout;
    }

    setTimeout(function() {
        if (callback !== undefined) {
            callback(key, map[key]);
        }
        delete map[key];
    }, timeout);
};

ExpireMap.prototype.remove = function(key) {
    if (this.containsKey(key)) {
        delete this._map[key];
        return true;
    } else {
        return false;
    }
};

ExpireMap.prototype.keys = function() {
    return Object.keys(this._map);
};

ExpireMap.prototype.containsKey = function(key) {
    return this._map[key] !== undefined;
};

ExpireMap.prototype.toJSON = function() {
    return {
        map: this._map,
        defaultTimeout: this._defaultTimeout
    };
};

ExpireMap.prototype.dump = function() {
    return JSON.stringify(this);
};
