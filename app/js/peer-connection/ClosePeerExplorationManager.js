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

PeerDash.di.ClosePeerExplorationManager = function() {
    "use strict";
    var logger = new PeerDash.Logger("CLOSEPEER", {
        debug: false
    });

    logger.debug("PeerDash.di.ClosePeerExplorationManager instantiated");

    /*
     * Timeouts
     */
    var CLOSEPEER_REQUEST_TIMEOUT = 3000,
        CLOSEPEER_CYCLE_INTERVAL = 3888,
        UPDATE_FROM_CYCLON_INTERVAL = 1222;

    /*
     * Constants
     */
    var REQUEST = 'REQUEST',
        RESPONSE = 'RESPONSE',
        LABEL = 'CLOSEPEER',
        MAX_PEERS = 16;

    /*
     * Member variables
     */
    var me,
        peers = [];

    /*
     * Private methods
     */

    var start = function() {
        me = this.commonData.me;
        this.connectionPool.setRequestHandler(
            LABEL,
            requestHandler.bind(this)
        );
        logger.debug("STARTED");
        setInterval(
            nextCycle.bind(this),
            CLOSEPEER_CYCLE_INTERVAL
        );
        setInterval(
            updateFromCyclon.bind(this),
            UPDATE_FROM_CYCLON_INTERVAL
        );
    };

    var mergePeers = function(newPeers) {
        var i, p;
        // Add peers if they do not exist
        var peersLength = peers.length;
        addNewPeers: while (newPeers.length > 0) {
            p = newPeers.pop();
            if (p.id == me.id)
                continue;
            for (i = 0; i < peersLength; i++)
                if (p.id == peers[i].id) {
                    peers[i].coord = p.coord;
                    continue addNewPeers;
                }
            peers.push(p);
        }
        peersLength = peers.length;
        for (i = 0; i < peersLength; i++) {
            peers[i].distance = this.vivaldiCoordinate.distance(peers[i].coord);
        }

        // Sort peers after distance
        peers.sort(function(a, b) {
            return a.distance - b.distance;
        });

        // Remove the extra peers
        peers.splice(MAX_PEERS);
    };

    var findClosePeers = function(nbCoord) {
        var nbDistance = this.vivaldiCoordinate.distance(nbCoord);
        var closePeers = [];
        for (var i = 0; i < peers.length; i++) {
            var p = peers[i];
            var distance = this.vivaldiCoordinate.distanceBetweenTwoCoordinates(nbCoord, p.coord);
            if (distance < nbDistance) {
                var cp = _.pick(p, 'id', 'coord', 'upload');
                cp.distance = distance;
                closePeers.push(cp);
            }
        }
        return closePeers;
    };

    var nextCycle = function() {
        var self = this;

        updateFromCyclon.call(this);

        if (peers.length === 0) {
            logger.debug("No peers");
            return;
        }
        // Choose a random peer
        var randomIndex = Math.floor(Math.random() * peers.length);
        var nb = peers[randomIndex];
        logger.log("Chosen peer for this cycle: " + nb.id);
        // Connect to peer
        this.connectionPool.connect.call(this, nb.id)
            .then(function(conn) {
                var startTime = Date.now();
                var requestFinished = false;
                var message = {
                    prot: LABEL,
                    type: REQUEST,
                    sender: me.id,
                    timestamp: startTime,
                    coord: self.vivaldiCoordinate.coord()
                };

                // Send request
                conn.send(message);
                logger.debug("Request sent to " + conn.peer);

                // Set timeout for response
                setTimeout(function() {
                    if (requestFinished === false) {
                        logger.log("No response received from " + conn.peer);
                        if (conn.open) {
                            self.connectionPool.closeConnection(conn);
                        }
                        peers.remove(nb);
                    }
                }, CLOSEPEER_REQUEST_TIMEOUT);

                var connOnData = function(res) {
                    if (res.type == RESPONSE && res.timestamp == startTime) {
                        logger.debug("Received response from " + conn.peer);

                        // Merge in received peers
                        mergePeers.call(self, res.peers);
                        requestFinished = true;
                        conn.removeListener('data', connOnData);
                    }
                };
                conn.on('data', connOnData);
            }).
        catch (function(error) {
            peers.remove(nb);
            logger.log("Error during connect: " + error);
        });
    };

    var updateFromCyclon = function() {
        // Merge in cyclon Peers
        var cyclonPeers = this.cyclonProtocol.peers();
        mergePeers.call(this, cyclonPeers);
    };

    var requestHandler = function(req, conn) {
        var closePeers = findClosePeers.call(this, req.coord);
        return {
            prot: LABEL,
            type: RESPONSE,
            timestamp: req.timestamp,
            peers: closePeers
        };
    };

    /*
     * The returned object containing public attributes and methods
     */
    return {
        commonData: undefined,
        connectionPool: undefined,
        cyclonProtocol: undefined,
        vivaldiCoordinate: undefined,
        start: start,
        addPeer: function(peer) {
            mergePeers.call(this, [peer]);
        },
        getPeer: function(id) {
            return _.find(peers, function(p) {
                return p.id == id;
            });
        },
        peers: function() {
            return peers;
        }
    };
};

PeerDash.di.ClosePeerExplorationManager.prototype = {
    constructor: PeerDash.di.ClosePeerExplorationManager
};
