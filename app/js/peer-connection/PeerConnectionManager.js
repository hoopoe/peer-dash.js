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

PeerDash.di.PeerConnectionManager = function() {
    "use strict";
    var logger = new PeerDash.Logger("CONNMAN", {
        debug: false
    });

    logger.debug("PeerDash.di.PeerConnectionManager instantiated");

    /*
     * Peer configuration
     */
    var peerServer = PeerDash.conf.peerServer,
        peerServerPort = PeerDash.conf.peerServerPort,
        peerServerKey = PeerDash.conf.peerServerKey,
        iceServers = PeerDash.conf.iceServers;

    /*
     * Timeouts
     */
    var peerServerTimeout = 5000;

    /*
     * Connection handlers
     */
    var connectionHandlers = {};

    /*
     * Private methods
     */
    var openConnectionToPeerServer = function() {
        var deferred = Q.defer();

        if (!PeerDash.enabled) {
            deferred.reject("Peer Assistance is disabled");
            return deferred.promise;
        }

        var me = new Peer({
            host: peerServer,
            port: peerServerPort,
            key: peerServerKey,
            debug: 2,
            config: {
                'iceServers': iceServers
            }
        });

        me.on('open', function(id) {
            logger.log("Connected as " + id);
            deferred.resolve();
        });

        /*
         * Handle incoming peer connection
         */
        me.on('connection', function(conn) {
            if (connectionHandlers[conn.label]) {
                connectionHandlers[conn.label](conn);
            } else {
                logger.error("Connection handler for label " + conn.label + " is not known");
            }
        });

        me.on('error', function(error) {
            if (error.message.indexOf('Could not connect to peer ') != -1)
                logger.debug(error);
            else
                logger.error("Error for PeerJS client: " + error);
        });

        me.on('close', function() {
            logger.log("PeerJS client closed");
        });

        this.commonData.me = me;

        return deferred.promise.timeout(peerServerTimeout);
    };

    var destroy = function() {
        if (this.commonData.me && !this.commonData.me.destroyed) {
            this.commonData.me.destroy();
        }
    };

    return {
        commonData: undefined,
        init: function(_connectionHandlers) {
            connectionHandlers = _connectionHandlers;
            return openConnectionToPeerServer.call(this)
                .then(function() {
                    logger.debug("STARTED");
                });
        },
        openConnectionToPeerServer: openConnectionToPeerServer,
        destroy: destroy
    };
};

PeerDash.di.PeerConnectionManager.prototype = {
    constructor: PeerDash.di.PeerConnectionManager
};
