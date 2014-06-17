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

PeerDash.di.BandwidthReporter = function() {
    "use strict";
    var logger = new PeerDash.Logger("BW", {
        debug: false
    });

    var bwTest = function() {
        var self = this;
        var deferred = Q.defer();

        var imageAddr = "http://lajv-bandwidth-tester.herokuapp.com/app/img/1mb.jpg" + "?n=" + Math.random();
        var startTime, endTime;

        var xhr = new XMLHttpRequest();
        xhr.open("GET", imageAddr, true);

        xhr.onloadstart = function() {
            startTime = (new Date()).getTime();
        };

        xhr.onloadend = function() {
            endTime = (new Date()).getTime();
            var duration = (endTime - startTime) / 1000;
            var bitsLoaded = xhr.response.length * 8;
            self.commonData.downloadSpeedBps = (bitsLoaded / duration);
            logger.log("Download speed: " + (self.commonData.downloadSpeedBps / 1000).toFixed(2) + " kbps ," + self.commonData.downloadSpeedBps + " bps");
            deferred.resolve(xhr.response);
        };

        xhr.onerror = function(error) {
            deferred.reject("XHR error: " + error);
        };

        xhr.send();
        return deferred.promise.then(uploadTest.bind(this));
    };

    var uploadTest = function(response) {
        var self = this;
        var deferred = Q.defer();

        var data = new Blob([response], {
            type: "image/jpeg"
        });

        var imageAddr = "http://lajv-bandwidth-tester.herokuapp.com";
        var startTime, endTime;

        var xhr = new XMLHttpRequest();
        xhr.open("POST", imageAddr, true);

        xhr.upload.onloadstart = function() {
            startTime = (new Date()).getTime();
        };

        xhr.upload.onloadend = function() {
            endTime = (new Date()).getTime();
            var duration = (endTime - startTime) / 1000;
            var bitsLoaded = response.length * 8;
            self.commonData.uploadSpeedBps = (bitsLoaded / duration);
            logger.log("Upload speed: " + (self.commonData.uploadSpeedBps / 1000).toFixed(2) + " kbps " + self.commonData.uploadSpeedBps + " bps");
            deferred.resolve();
        };

        xhr.onerror = function(error) {
            deferred.reject("XHR error: " + error);
        };

        xhr.send(data);
        return deferred.promise;
    };

    return {
        commonData: undefined,
        bwTest: bwTest
    };
};

PeerDash.di.BandwidthReporter.prototype = {
    constructor: PeerDash.di.BandwidthReporter
};
