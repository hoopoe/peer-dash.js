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

PeerDash.di.SegmentManager = function() {
    "use strict";
    var logger = new PeerDash.Logger("SEGMAN");

    logger.debug("PeerDash.di.SegmentManager instantiated");

    /*
     * Constants
     */
    var REQUEST = 'REQUEST',
        RESPONSE = 'RESPONSE',
        LABEL = "SEGMENT",
        INIT_SEGMENT = "Initialization Segment",
        INIT_COUNT = 4;

    var REASON_INIT_BUFFER = 'INIT_BUFFER',
        REASON_RESPONSIBLE = 'RESPONSIBLE',
        REASON_FALLBACK = 'FALLBACK',
        REASON_NO_PEERS = 'NO_PEERS',
        REASON_LOW_BUFFER = 'LOW_BUFFER';

    var REASON_NO_DATA_NO_DECISION_YET = 'NO_DECISION_YET',
        REASON_NO_DATA_OTHER_BITRATE = 'OTHER_BITRATE',
        REASON_NO_DATA_NOT_RESPONSIBLE = 'NOT_RESPONSIBLE',
        REASON_NO_DATA_PAUSED = 'PAUSED',
        REASON_NO_DATA_NOT_STARTED = 'NOT_STARTED',
        REASON_NO_DATA_INIT_BUFFER = 'INIT_BUFFER',
        REASON_NO_DATA_NOT_YET_DOWNLOADED = 'NOT_YET_DOWNLOADED';

    /*
     * Member variables
     */
    var me,
        segments = new ExpireMap(),
        fromPeersCount = 0,
        fromServerCount = 0,
        ready = false,
        videoBitrate = 0,
        audioBitrate = 0,
        initCount = {
            'video': 0,
            'audio': 0
        },
        respDecisions = {
            'audio': {},
            'video': {}
        },
        startedPlaying = false;

    /*
     * Private methods
     */

    var fetch = function(request) {
        if (startedPlaying === false)
            startedPlaying = true;
        logger.log("Issuing request for " + request.url);
        var self = this;
        if (!PeerDash.enabled) {
            logger.log("Peer Assistance is not enabled");
            return Q.reject();
        }
        if (!ready) {
            logger.log("SegmentManager is not yet ready to fetch from peers");
            return Q.reject();
        }

        // If Initialization Segment, fetch from server
        if (request.type === INIT_SEGMENT) {
            return Q.reject("Segment is of type '" + INIT_SEGMENT + "' it will be fetched from server");
        }

        if (request.streamType === "video") {
            this.commonData.currentVideoBitrate = this.metricsExt.getBandwidthForRepresentation(request.repId);
            if(videoBitrate != this.commonData.currentVideoBitrate) {
                logger.debug("Video bitrate changed");
                videoBitrate = this.commonData.currentVideoBitrate;
                self.neighbourManager.notifyBitrateChange();
            }
        }

        if (request.streamType === "audio") {
            this.commonData.currentAudioBitrate = this.metricsExt.getBandwidthForRepresentation(request.repId);
            if(audioBitrate != this.commonData.currentAudioBitrate) {
                logger.debug("Audio bitrate changed");
                audioBitrate = this.commonData.currentAudioBitrate;
            }
        }

        if (initCount[request.streamType] < INIT_COUNT) {
            initCount[request.streamType]++;
            increaseFromServerCount.call(this, REASON_INIT_BUFFER);
            return Q.reject("Init from server to fill buffer");
        }

        // Current playback time in seconds
        var currentTime = this.videoModel.getCurrentTime();

        // Time in seconds until the requested segment will be played
        var untilPlayback = request.startTime - currentTime;

        // Threshold for when segments should be fetched from server
        var lowBufferThreshold = request.duration * 4;

        logger.debug("Current time: " + currentTime);
        logger.debug("Request start time: " + request.startTime);
        logger.debug("Time until playback: " + untilPlayback);

        // The maximum difference in time two clients should have
        // var maximumTimeDiff = request.duration;

        // The time after which a responsible should have fetched a segment
        // var waitTime = (maximumTimeDiff + request.duration);

        var waitTime = 6;

        // The maximum time it should take to fetch from another peer
        var receiveSegmentTime = request.duration * 2;

        if (untilPlayback < receiveSegmentTime + lowBufferThreshold) {
            increaseFromServerCount.call(this, REASON_LOW_BUFFER);
            return Q.reject("Playback for request is close: " + untilPlayback);
        }

        // If the request is very close to playback, don't wait before sending requests
        else if (untilPlayback < waitTime + receiveSegmentTime + lowBufferThreshold) {
            waitTime = untilPlayback - receiveSegmentTime - lowBufferThreshold;
        }

        var deferred = Q.defer();

        var responsiblePeers = this.responsibilityCoordinator.calculateResponsibility(request);

        var decision = {
            repId: request.repId,
            responsible: false
        };
        respDecisions[request.streamType][request.index] = decision;
        for (var i = 0; i < responsiblePeers.length; i++) {
            if (me.id === responsiblePeers[i].id) {
                decision.responsible = true;
                increaseFromServerCount.call(this, REASON_RESPONSIBLE);
                return Q.reject("Responsible of segment, will fetch from server");
            }
        }

        var req = {
            prot: LABEL,
            type: REQUEST,
            streamType: request.streamType,
            index: request.index,
            repId: request.repId,
            url: request.url,
            sender: me.id
        };

        logger.log("Will try to fetch this url from another peer: " + request.url);
        setTimeout(function() {
            sendSegmentRequest.call(self, request, req, responsiblePeers, deferred, receiveSegmentTime);
            setTimeout(
                function() {
                    if (deferred.promise.isPending()) {
                        increaseFromServerCount.call(self, REASON_FALLBACK);
                        deferred.reject("Need to fall back to server");
                    }
                },
                receiveSegmentTime * 1000
            );
        }, waitTime * 1000);


        return deferred.promise;
    };

    var sendSegmentRequest = function(request, req, nbs, deferred, receiveSegmentTime) {
        var self = this;
        if (nbs.length === 0) { // Also if timeout has passed
            increaseFromServerCount.call(this, REASON_NO_PEERS);
            deferred.reject(new Error("Could not fetch from any peer"));
            return;
        }
        if (deferred.promise.isRejected()) {
            logger.log("Promise has already timed out, " + req.url + " will not be fetched from peers");
            return;
        }
        if (deferred.promise.isFulfilled()) {
            logger.log("Response came after SEND_SEGMENT_REQUEST_TIMEOUT");
            return;
        }

        var randRespValue = Math.floor(Math.random() * nbs[nbs.length - 1].respValue);

        var selectedPeerIndex;

        // Find peer repsonsible for randRespValue
        nbs.some(function(element, index) {
            if (randRespValue <= element.respValue) {
                selectedPeerIndex = index;
                return true;
            }
        });

        var selectedPeer = nbs.splice(selectedPeerIndex, 1)[0];
        self.responsibilityCoordinator.calculateRespValue(nbs);

        self.connectionPool.connect(selectedPeer.id)
            .then(function(conn) {

                var connOnData = function(res) {
                    if (res.type == RESPONSE && res.url == req.url) {
                        conn.removeListener('data', connOnData);
                        // Data may be empty
                        if (res.data) {
                            logger.log("Received response from " + res.sender + " for segment " + res.url);
                            segments.put(req.url, res.data, function(key) {
                                logger.debug("Removing " + key + " from the segments map");
                            });
                            increaseFromPeersCount.call(self);
                            deferred.resolve(res.data);
                        } else {
                            logger.log("Received EMPTY response from " + conn.peer + " for segment " + req.url + " with reason: " + res.reason);
                            sendSegmentRequest.call(self, request, req, nbs, deferred, receiveSegmentTime);
                        }
                    }
                };

                conn.on('data', connOnData);

                conn.send(req);
                logger.log("Sending request to " + conn.peer + " for segment " + req.url);

                // If there is no response within SEND_SEGMENT_REQUEST_TIMEOUT ms, ask another peer.
                // If error or close event occurs request will wait until timeout before next request
                // Remove callback handler on data for connetion
                // FIX: Dont wait until timeout
                // NOTE: is it needed to remove callbacks or done by connection pool.
                setTimeout(
                    function() {
                        if (deferred.promise.isPending()) {
                            logger.log("Request for segment " + req.url + " timed out for peer " + conn.peer);
                            conn.removeListener('data', connOnData);
                            sendSegmentRequest.call(self, request, req, nbs, deferred, receiveSegmentTime);
                        }
                    },
                    receiveSegmentTime * 1000
                );
            }).
        catch (function(error) {
            // TODO: removeId
            // peers.remove(selectedPeer);
            logger.log("Error during sendSegmentRequest: " + error);
            sendSegmentRequest.call(self, request, req, nbs, deferred, receiveSegmentTime);
        });
    };

    var requestHandler = function(req) {
        // NOTE: Should we check for if(PeerDash.enabled)?
        logger.log("Received request from " + req.sender + " for segment " + req.url);
        var data = segments.get(req.url);
        var msg = {
            prot: LABEL,
            sender: me.id,
            type: RESPONSE,
            url: req.url,
            data: data
        };
        // Data may be empty
        if (data) {
            logger.log("Sending response with data back for segment " + req.url);
        } else {
            var decision = respDecisions[req.streamType][req.index];
            if (decision === undefined && startedPlaying === false) {
                // Reason: Not started playing
                msg.reason = REASON_NO_DATA_NOT_STARTED;
                // TODO: add cases for init buffer
            } else if (decision === undefined && initCount[req.streamType] < INIT_COUNT) {
                // Reason: Initializing buffer
                msg.reason = REASON_NO_DATA_INIT_BUFFER;
            } else if (decision === undefined && this.videoModel.isPaused()) {
                // Reason: Paused
                msg.reason = REASON_NO_DATA_PAUSED;
            } else if (decision === undefined) {
                // Reason: No decision yet
                msg.reason = REASON_NO_DATA_NO_DECISION_YET;
            } else if (decision.repId != req.repId) {
                // Reason: Other bitrate
                msg.reason = REASON_NO_DATA_OTHER_BITRATE;
            } else if (decision.responsible === false) {
                // Reason: Not responsible
                msg.reason = REASON_NO_DATA_NOT_RESPONSIBLE;
            } else {
                // Reason: Not yet downloaded
                msg.reason = REASON_NO_DATA_NOT_YET_DOWNLOADED;
            }
            this.stats.reportNoDataReason(msg.reason);
            logger.log("Sending EMPTY response back for segment " + req.url + " with reason: " + msg.reason);
        }
        return msg;
    };

    var setup = function() {
        var self = this;
        this.bandwidthReporter.bwTest()
            .fail(function(error) {
                logger.error("Failure during bandwidth test: " + error);
                return Q.reject(error);
            })
            .then(function() {
                var connectionHandlers = {};
                connectionHandlers[self.connectionPool.label] = self.connectionPool.getConnectionHandler();
                connectionHandlers[self.overlayController.label] = self.overlayController.getConnectionHandler();
                connectionHandlers['AUTOMATION'] = function(conn) {
                    //todo: change global flag heres
                    logger.debug("AUTOMATION: Yes I can receive commands!!!: " + conn.peer);
                };
                return self.peerConnectionManager.init(connectionHandlers)
                    .fail(function(error) {
                        logger.error("Failure when opening connection to peer server: " + error);
                        return Q.reject(error);
                    });
            })
            .then(function() {
                me = self.commonData.me;
                return self.bootstrapController.registerAtBootstrap()
                    .fail(function(error) {
                        logger.error("Failure when registering at bootstrap server: " + error);
                        return Q.reject(error);
                    });
            })
            .then(function() {
                self.overlayController.start();
                self.closePeerExplorationManager.start();
                self.neighbourManager.start();
                self.connectionPool.setRequestHandler(
                    LABEL,
                    requestHandler.bind(self)
                );
                self.stats.createWebSocket();
                self.stats.startPollingGlobalStats();
                logger.debug("STARTED");
                ready = true;
            });
    };

    var increaseFromServerCount = function(reason) {
        fromServerCount++;
        this.stats.reportFromServer(reason);
    };

    var increaseFromPeersCount = function() {
        fromPeersCount++;
        this.stats.reportFromPeer();
    };

    /*
     * The returned object containing public attributes and methods
     */
    return {
        segments: segments,
        commonData: undefined,
        connectionPool: undefined,
        bandwidthReporter: undefined,
        bootstrapController: undefined,
        overlayController: undefined,
        neighbourManager: undefined,
        closePeerExplorationManager: undefined,
        peerConnectionManager: undefined,
        vivaldiCoordinate: undefined,
        metricsExt: undefined,
        metricsModel: undefined,
        videoModel: undefined,
        responsibilityCoordinator: undefined,
        stats: undefined,
        setup: setup,
        fetch: function(request) {
            return fetch.call(this, request);
        },
        getMetrics: function() {
            return {
                fromPeersCount: fromPeersCount,
                fromServerCount: fromServerCount,
                nbCount: this.connectionPool.getNumberOfConnections()
            };
        },
        getSelfId: function() {
            return me ? me.id : 0;
        },
        setVideoModel: function(videoModel) {
            this.videoModel = videoModel;
        },
        resetSegmentManager: function() {
            initCount['audio'] = 0;
            initCount['video'] = 0;
            fromPeersCount = 0;
            fromServerCount = 0;
        }
    };
};

PeerDash.di.SegmentManager.prototype = {
    constructor: PeerDash.di.SegmentManager
};
