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

PeerDash.di.NeighbourManager = function() {
    "use strict";
    var logger = new PeerDash.Logger("NM", {
        debug: false
    });

    logger.debug("PeerDash.di.NeighbourManager instantiated");

    var REQUEST = 'REQUEST',
        RESPONSE = 'RESPONSE',
        NOTIFICATION = 'NOTIFICATION',
        PAUSED = 'PAUSED',
        BR_CHANGE = 'BR_CHANGE',
        LABEL = 'NEIGHMAN',
        REMOVE_FROM_INBOUND = 'REMOVE_FROM_INBOUND',
        REMOVE_FROM_OUTBOUND = 'REMOVE_FROM_OUTBOUND';

    var NEIGHBOUR_INTERVAL = 1555,
        MAX_NEIGHBOURS = 16,
        NEIGHBOUR_REQUEST = 1000;

    var me,
        peers,
        playing = false,
        inboundPeers = [],
        outboundPeers = [],
        blacklistedPeers = [];

    var start = function() {
        me = this.commonData.me;
        this.connectionPool.setRequestHandler(
            LABEL,
            requestHandler.bind(this)
        );

        peers = this.closePeerExplorationManager.peers();

        setInterval(
            nextCycle.bind(this),
            NEIGHBOUR_INTERVAL
        );

        logger.debug("STARTED");
    };

    var nextCycle = function() {
        var self = this;
        logger.debug("outboundPeers in cycle: " + JSON.stringify(outboundPeers, null, 2));

        logger.debug("PEERS:" + JSON.stringify(peers, null, 2));

        // Filter out outboundPeers from peers
        var peersLeft = _.difference(peers, outboundPeers, blacklistedPeers);

        // Sort peersLeft in decreasing distance
        peersLeft = _.sortBy(peersLeft, function(p) {
            return -p.distance;
        });

        logger.debug("PEERS LEFT:" + JSON.stringify(peersLeft, null, 2));
        logger.debug("OUTBOUND PEERS:" + JSON.stringify(outboundPeers, null, 2));

        var deferred = Q.defer();

        if (playing && self.commonData.currentVideoBitrate !== 0) {
            Q.fcall(updateNeighbours.bind(self), peersLeft, deferred).then(function() {
                logger.debug("neighbouringPeers: " + JSON.stringify(outboundPeers, null, 2));
            });
        }

    };

    var getPeerDescriptor = function(msg) {

        var neighbour = this.closePeerExplorationManager.getPeer(msg.sender);
        if (neighbour) {
            logger.log("Peer " + neighbour.id + " found in CLOSEPEER");
        }

        // Still no neighbour!!!!!
        if (!neighbour) {
            neighbour = {
                id: msg.sender,
                upload: msg.upload,
            };
            logger.log("Peer " + neighbour.id + " added to CLOSEPEER");

            this.closePeerExplorationManager.addPeer(neighbour);
        }

        return neighbour;
    };

    var updateNeighbours = function(peersLeft, deferred) {
        var self = this;

        if (peersLeft.length === 0) {
            return deferred.resolve();
        }

        var peer = peersLeft.pop();

        var rejectOutboundPeer = function() {
            outboundPeers = _.reject(outboundPeers, function(p) {
                return p.id == peer.id;
            });
        };

        var queryNeighbour = function() {
            self.connectionPool.connect(peer.id)
                .then(function(conn) {

                        var req = {
                            prot: LABEL,
                            type: REQUEST,
                            timestamp: Date.now(),
                            bitrate: self.commonData.currentVideoBitrate,
                            coord: self.vivaldiCoordinate.coord(),
                            upload: self.commonData.uploadSpeedBps,
                            sender: me.id
                        };

                        var queryTimeout = setTimeout(
                            function() {
                                if (deferred.promise.isPending()) {
                                    logger.log("Request for neighbour update timed out for peer " + conn.peer);
                                    conn.removeListener('data', connOnData);
                                    conn.removeListener('error', rejectOutboundPeer);
                                    conn.removeListener('close', rejectOutboundPeer);
                                    updateNeighbours.call(self, peersLeft, deferred);
                                }
                            },
                            NEIGHBOUR_REQUEST
                        );

                        var connOnData = function(res) {
                            if (res.type == RESPONSE && res.timestamp == req.timestamp) {
                                logger.log("Got response from: " + res.sender);
                                conn.removeListener('data', connOnData);
                                clearTimeout(queryTimeout);

                                if (res.bitrate == req.bitrate && res.playing && res.bitrate !== 0) {

                                    var neighbour = _.find(inboundPeers, function(p) {
                                        return p.id == res.sender;
                                    });

                                    if (neighbour) {
                                        logger.log("Peer " + res.sender + " found in inboundPeers upgrade to outbound");
                                    } else {
                                        logger.log("Peer " + res.sender + " not found in inboundPeers add as outbound");
                                    }

                                    if (!neighbour) {
                                        neighbour = getPeerDescriptor.call(self, res);
                                    }

                                    logger.debug("queryNeighbour: Peer: " + res.sender + " added as outbound");

                                    neighbour.bitrate = res.bitrate;
                                    neighbour.coord = res.coord;

                                    // Add new peer at front to update the outbound list size
                                    outboundPeers.unshift(neighbour);

                                    conn.once('error', rejectOutboundPeer);
                                    conn.once('close', rejectOutboundPeer);

                                    // Reduce size of outbound peers to contain only MAX_NEIGHBOURS.
                                    var splicedPeers = outboundPeers.splice(MAX_NEIGHBOURS);

                                    var peersToClose = _.difference(splicedPeers, inboundPeers);

                                    var peersToNotify = _.intersection(splicedPeers, inboundPeers);


                                    peersToNotify.forEach(function(p) {
                                        notifyRemoveFromPeerSet(p.id, REMOVE_FROM_INBOUND);
                                    });

                                    peersToClose.forEach(function(p) {
                                        self.connectionPool.closeConnectionById(p.id);
                                    });

                                    logger.debug("Peers no longer ");
                                } else {
                                    logger.log("Peer is paused: '" + res.playing + "' or at wrong bitrate: " + res.bitrate);
                                    blacklistedPeers.push(peer);
                                    // TODO: Remove listeners
                                }

                                updateNeighbours.call(self, peersLeft, deferred);
                            }
                        };

                        conn.on('data', connOnData);

                        conn.send(req);

                        logger.log("Sending request to " + conn.peer + " for neigbour update");
                    },
                    function(error) {
                        peers.remove(peer.id);
                        logger.error("Error during connect to " + peer.id + " in queryNeighbour: " + error);
                        updateNeighbours.call(self, peersLeft, deferred);
                    });
        };

        // Sort in increasing distance
        outboundPeers = _.sortBy(outboundPeers, function(p) {
            return p.distance;
        });

        // If still space in outbound peers, try to add and connect.
        if (outboundPeers.length < MAX_NEIGHBOURS) {
            logger.log("Still room in list for peer: " + peer.id);
            queryNeighbour();
        }
        // If no space, try to add if closer and remove the most distant peer.
        else if (peer.distance < _.last(outboundPeers).distance) {
            logger.log("No room for peer: " + peer.id + " but it is close enough, swap it with: " + _.last(outboundPeers).id);
            queryNeighbour();
        } else {
            // TODO: Potential dangerous, may not return deferred.promise (or just go one step down and then come out and return promise)
            logger.log("Not room and not close enough for peer: " + peer.id + " trying other peer");
            updateNeighbours.call(self, peersLeft, deferred);
        }

        return deferred.promise;
    };

    var deletePeerFromInbound = function(id) {
        inboundPeers = _.reject(inboundPeers, function(p) {
            return p.id == id;
        });
    };

    var deletePeerFromOutbound = function(id) {
        outboundPeers = _.reject(outboundPeers, function(p) {
            return p.id == id;
        });
    };

    var requestHandler = function(req, conn) {
        var self = this;

        if (req.type == REQUEST) {

            var rejectInboundPeer = function() {
                inboundPeers = _.reject(inboundPeers, function(p) {
                    return p.id == req.sender;
                });
            };

            // If blacklisted, then remove from blacklisted becasue it is now playing and has same bitrate.
            if (req.bitrate == self.commonData.currentVideoBitrate) {
                blacklistedPeers = _.reject(blacklistedPeers, function(p) {
                    return p.id == req.sender;
                });
            }

            if (req.bitrate == self.commonData.currentVideoBitrate && playing) {

                conn.once('error', rejectInboundPeer);
                conn.once('close', rejectInboundPeer);

                // Check if connecting peer exists as outbound.
                var neighbour = _.find(outboundPeers, function(p) {
                    return p.id == req.sender;
                });

                if (neighbour) {
                    logger.log("Peer " + req.sender + " found in outboundPeers upgrade to inbound");
                } else {
                    logger.log("Peer " + req.sender + " not found in inboundPeers add as inbound");
                }

                if (!neighbour) {
                    neighbour = getPeerDescriptor.call(self, req);
                }

                neighbour.bitrate = req.bitrate;
                neighbour.coord = req.coord;
                inboundPeers.push(neighbour);
                logger.debug("requestHandler: Peer: " + req.sender + " added as inbound");

            } else {
                if (playing) {
                    logger.log("Peer is at wrong bitrate");
                } else {
                    logger.log("I am paused");
                }
            }

            logger.debug("Sending response to: " + req.sender);
            return {
                prot: LABEL,
                type: RESPONSE,
                timestamp: req.timestamp,
                sender: me.id,
                playing: playing,
                coord: self.vivaldiCoordinate.coord(),
                upload: self.commonData.uploadSpeedBps,
                bitrate: self.commonData.currentVideoBitrate
            };
        } else if (req.type == NOTIFICATION) {
            if (req.notificationType == PAUSED || req.notificationType == BR_CHANGE) {
                logger.log("My neighbours video stream is paused or bitrate changed");

                var inbound = _.find(inboundPeers, function(p) {
                    return p.id == req.sender;
                });
                var outbound = _.find(outboundPeers, function(p) {
                    return p.id == req.sender;
                });

                if (inbound) {
                    inboundPeers = _.without(inboundPeers, inbound);
                }

                if (outbound) {
                    outboundPeers = _.without(outboundPeers, outbound);
                }

                var blacklisted = inbound || outbound;

                if (blacklisted) {
                    blacklistedPeers.push(blacklisted);
                }

                self.connectionPool.closeConnection(conn);
            } else if (req.notificationType == REMOVE_FROM_INBOUND) {

                logger.log("I was kicked out as outbound peer at: " + req.sender);

                deletePeerFromInbound(req.sender);

                // If request from req.sender came in after sending a REMOVE_FROM_INBOUND to req.sender.
                // E.g req.sender is not present anymore in outboundPeers
                // Then connection should be closed since both removed eachother from outbound lists
                var outboundPeer = _.find(outboundPeers, function(p) {
                    return p.id == req.sender;
                });

                if (!outboundPeer) {
                    self.connectionPool.closeConnectionById(req.sender);
                }

            } else if (req.notificationType == REMOVE_FROM_OUTBOUND) {

                logger.log("I was kicked out as inbound peer at: " + req.sender);

                deletePeerFromOutbound(req.sender);

                // If request from req.sender came in after sending a REMOVE_FROM_OUTBOUND to req.sender.
                // E.g req.sender is not present anymore in inboundPeers
                // Then connection should be closed since both removed eachother from inbound lists
                var inboundPeer = _.find(inboundPeers, function(p) {
                    return p.id == req.sender;
                });

                if (!inboundPeer) {
                    self.connectionPool.closeConnectionById(req.sender);
                }

            } else {
                logger.error("Unknown notificationType: " + req.notificationType);
            }
        }
    };

    var notifyRemoveFromPeerSet = function(id, notificationType) {
        this.connectionPool.connect(id)
            .then(function(conn) {

                var req = {
                    prot: LABEL,
                    type: NOTIFICATION,
                    notificationType: notificationType,
                    sender: me.id
                };

                conn.send(req);
                logger.log("Sent notify to " + conn.peer);
            }).
        catch (function(error) {
            deletePeerFromInbound(id);
            deletePeerFromOutbound(id);
            peers.remove(id);
            logger.error("Error during connect to " + id + " in notifyRemoveFromPeerSet: " + error);
        });
    };

    var notifyBitrateOrPlayStatus = function(req, neighbours) {
        var self = this;
        for (var i = 0; i < neighbours.length; i++) {
            self.connectionPool.connect(neighbours[i].id)
                .then(function(conn) {

                    deletePeerFromInbound(conn.peer);
                    deletePeerFromOutbound(conn.peer);

                    conn.send(req);
                    logger.log("Sent notify to " + conn.peer);
                }).
            catch (function(error) {
                deletePeerFromInbound(neighbours[i].id);
                deletePeerFromOutbound(neighbours[i].id);
                peers.remove(neighbours[i].id);
                logger.error("Error during connect to " + neighbours[i].id + " in notifyBitrateOrPlayStatus: " + error);
            });
        }
    };

    return {
        videoModel: undefined,
        closePeerExplorationManager: undefined,
        vivaldiCoordinate: undefined,
        commonData: undefined,
        connectionPool: undefined,
        start: start,
        pause: function() {

            playing = false;
            logger.log("Stream is PAUSED");
            var req = {
                prot: LABEL,
                type: NOTIFICATION,
                notificationType: PAUSED,
                sender: me.id
            };

            notifyBitrateOrPlayStatus.call(this, req, _.union(outboundPeers, inboundPeers));
        },
        play: function() {
            logger.log("Stream is PLAYED");
            playing = true;
        },
        getInboundPeers: function() {
            return inboundPeers;
        },
        getOutboundPeers: function() {
            return outboundPeers;
        },
        notifyBitrateChange: function() {
            logger.log("Stream changed BITRATE to: " + this.commonData.currentVideoBitrate);

            var req = {
                prot: LABEL,
                type: NOTIFICATION,
                notificationType: BR_CHANGE,
                bitrate: this.commonData.currentVideoBitrate,
                sender: me.id
            };

            notifyBitrateOrPlayStatus.call(this, req, _.union(outboundPeers, inboundPeers));
        }
    };
};

PeerDash.di.NeighbourManager.prototype = {
    constructor: PeerDash.di.NeighbourManager
};
