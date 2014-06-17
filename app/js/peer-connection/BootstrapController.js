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

PeerDash.di.BootstrapController = function() {
    "use strict";
    var logger = new PeerDash.Logger("BSCTRL", {
        debug: false
    });

    var BOOTSTRAP_SERVER_TIMEOUT = 5000;

    var bootstrapServer = PeerDash.conf.bootstrapServer,
        bootstrappingPeers = [];

    /*
     *  Registers peer at bootstrap server
     */
    var registerAtBootstrap = function() {
        var self = this;
        var deferred = Q.defer();
        var xhr = new XMLHttpRequest();
        xhr.open("GET", bootstrapServer + "/?id=" + this.commonData.me.id);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var response = JSON.parse(xhr.responseText);
                for (var i = 0; i < response.peers.length; i++) {
                    if (response.peers[i] != self.commonData.me.id) {
                        bootstrappingPeers.push({
                            id: response.peers[i]
                        });
                    }
                }
                logger.log("Received response from bootstrap server with " + response.peers.length + " peers");
                deferred.resolve();
            }
        };
        logger.debug("Sending request to bootstrap server");
        xhr.send();
        return deferred.promise.timeout(BOOTSTRAP_SERVER_TIMEOUT);
    };

    /*
     *  Unregisters peer from bootstrap server
     */
    var unregisterAtBootstrap = function() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", bootstrapServer + "/delete?id=" + this.commonData.me.id, false); // false -> synchronous
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 && xhr.status == 202) {
                logger.log("Received correct response from bootstrap server");
            }
        };
        logger.log("Sending delete request to bootstrap server");
        xhr.send();
    };

    /*
     *  Refills with bootstrapping peers from bootstrap server
     */
    var refillFromBootstrap = function() {
        var self = this;
        var deferred = Q.defer();
        var xhr = new XMLHttpRequest();
        xhr.open("GET", bootstrapServer + "/refill?id=" + this.commonData.me.id);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var response = JSON.parse(xhr.responseText);

                for (var i = 0; i < response.peers.length; i++) {
                    if (response.peers[i] != self.commonData.me.id) {
                        bootstrappingPeers.push({
                            id: response.peers[i]
                        });
                    }
                }
                logger.debug("Refill response from bootstrap server with " + response.peers.length + " peers");
                if (bootstrappingPeers.length > 0)
                    deferred.resolve(bootstrappingPeers.pop());
                else
                    deferred.reject("Bootstrap server has no other peers");
            }
        };
        xhr.send();
        return deferred.promise.timeout(BOOTSTRAP_SERVER_TIMEOUT);
    };

    var nextFromBootstrap = function() {
        var peer = bootstrappingPeers.pop();
        if (peer)
            return Q.resolve(peer);
        else
            return refillFromBootstrap.call(this);
    };

    /*
     *  Report dead peer to bootstrap server
     */
    var reportDeadPeer = function(peerId) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", bootstrapServer + "/delete?id=" + peerId);
        logger.log("Reporting dead peer to bootstrap: " + peerId);
        xhr.send();
    };

    return {
        commonData: undefined,
        registerAtBootstrap: registerAtBootstrap,
        unregisterAtBootstrap: unregisterAtBootstrap,
        nextFromBootstrap: nextFromBootstrap,
        reportDeadPeer: reportDeadPeer.bind(this)
    };
};

PeerDash.di.BootstrapController.prototype = {
    constructor: PeerDash.di.BootstrapController
};
