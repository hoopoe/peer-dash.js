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

PeerDash.di.OverlayController = function() {
    "use strict";
    var logger = new PeerDash.Logger("OVERLAY", {
        debug: false
    });

    logger.debug("PeerDash.di.OverlayController instantiated");

    /*
     * Timeouts
     */
    var PEER_CONNECT_TIMEOUT = 2000,
        OVERLAY_CYCLE_INTERVAL = 1111;

    /*
     * Constants
     */
    var REQUEST = 'REQUEST',
        LABEL = 'OVERLAY';


    /*
     * Member variables
     */

    var start = function() {
        setInterval(
            nextCycle.bind(this),
            OVERLAY_CYCLE_INTERVAL);
        logger.debug("STARTED");
    };

    /*
     * Private methods
     */

    var addEventListeners = function(conn) {
        var self = this;
        conn.on('data', function(msg) {
            if (msg.type == REQUEST) {
                if (msg.prot == self.cyclonProtocol.label)
                    conn.send(self.cyclonProtocol.handleRequest(msg));
                else if (msg.prot == self.vivaldiProtocol.label)
                    conn.send(self.vivaldiProtocol.handleRequest(msg));
            }
        });
        conn.once('error', function() {
            logger.debug("Error for connection with " + conn.peer);
            conn.removeAllListeners();
            conn.close();
        });
        conn.once('close', function() {
            logger.debug("Connection with " + conn.peer + " closed");
            conn.removeAllListeners();
        });
    };


    /*
     *  Initates a new connection to @peerId.
     */
    var connect = function(peer) {
        var deferred = Q.defer();

        var conn = this.commonData.me.connect(peer.id, {
            label: LABEL,
            reliable: true
        });

        conn.once('open', function() {
            logger.debug("Now connected to " + conn.peer);
            deferred.resolve(conn);
        });

        // Specific error case to reject deferred
        conn.on('error', function() {
            logger.debug("Connection could not be established");
            this.cyclonProtocol.reportDeadPeer(conn.peer);
            deferred.reject(new Error("Connection could not be established"));
        });

        // Listener for close and error
        addEventListeners.call(this, conn);

        return deferred.promise.timeout(PEER_CONNECT_TIMEOUT);
    };

    var closeConnection = function(conn) {
        conn.close();
        conn.removeAllListeners();
        logger.debug("Connection to " + conn.peer + " closed");
    };

    var nextCycle = function() {
        var self = this;
        this.cyclonProtocol.nextPeer()
            .then(function(peer) {
                return connect.call(self, peer)
                    .fail(function() {
                        logger.debug("Could not connect to " + peer.id);
                        self.cyclonProtocol.reportDeadPeer(peer);
                    });
            })
            .then(function(conn) {
                Q.fcall(function() {
                    return self.cyclonProtocol.nextCycle(conn)
                        .fail(function(error) {
                            logger.debug("Error in nextCycle for cyclonProtocol: " + error);
                            closeConnection.call(self, conn);
                            return Q.reject(error);
                        });
                }).then(function() {
                    return self.vivaldiProtocol.nextCycle(conn)
                        .fail(function(error) {
                            logger.debug("Error in nextCycle for vivaldiProtocol: " + error);
                            closeConnection.call(self, conn);
                            return Q.reject(error);
                        });
                }).then(function() {
                    logger.debug("nextCycle in OverlayController successfully executed");
                    closeConnection.call(self, conn);
                });
            });
    };

    /*
     *  Processes incoming peer connections from remote peers
     *  (connection initiated by remote peer). PeerConnectionManager
     *  calls this function with connection object @conn as argument
     *  upon incoming connection requests for label: LABEL.
     */
    var handleConnection = function(conn) {
        logger.debug("New connection for peer: " + conn.peer);
        // Listener for close and error
        addEventListeners.call(this, conn);
    };

    var destroy = function() {
        this.bootstrapController.unregisterAtBootstrap();
        this.peerConnectionManager.destroy();
    };

    /*
     * The returned object containing public attributes and methods
     */
    return {
        cyclonProtocol: undefined,
        vivaldiProtocol: undefined,
        peerConnectionManager: undefined,
        vivaldiCoordinate: undefined,
        bootstrapController: undefined,
        commonData: undefined,
        start: start,
        getConnectionHandler: function() {
            return handleConnection.bind(this);
        },
        setup: function() {
            window.onunload = destroy.bind(this);
        },
        label: LABEL
    };
};

PeerDash.di.OverlayController.prototype = {
    constructor: PeerDash.di.OverlayController
};
