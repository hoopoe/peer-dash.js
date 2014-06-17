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

PeerDash.di.CyclonProtocol = function() {
    "use strict";
    var logger = new PeerDash.Logger("CYCPROT", {
        debug: false
    });
    logger.debug("PeerDash.di.CyclonProtocol instantiated");

    /*
     * Timeouts
     */
    var CYCLON_REQUEST_TIMEOUT = 3000;

    /*
     * Constants
     */
    var REQUEST = 'REQUEST',
        RESPONSE = 'RESPONSE',
        LABEL = 'CYCLON';

    /*
     * Cyclon parameters
     */
    var L = 5,
        MAX_NEIGHBOURS = 20;

    /*
     * Member variables
     */
    var peers = [];

    /*
     * Methods
     */

    /*
     *  Increases the age of all descriptors by one and returns the peer object with highest age.
     */
    var increasePeerAgeAndRemoveOldest = function() {
        var maxAge = 0;
        var oldestPeer;
        for (var i = 0; i < peers.length; i++) {
            peers[i].age++;
            if (peers[i].age > maxAge) {
                oldestPeer = peers[i];
                maxAge = peers[i].age;
            }
        }
        return peers.remove(oldestPeer);
    };

    var addShuffledPeers = function(shufflePeers, splicedPeers) {
        var i, p;
        // Add new peers if they do not already exist
        var peersLength = peers.length;
        add_shuffle: while (shufflePeers.length > 0) {
            p = shufflePeers.pop();
            if (p.id == this.commonData.me.id)
                continue;
            for (i = 0; i < peersLength; i++)
                if (p.id == peers[i].id)
                    continue add_shuffle;
            peers.push(p);
        }
        // Fill up with spliced peers if necessary
        peersLength = peers.length;
        add_spliced: while (MAX_NEIGHBOURS > peers.length && splicedPeers.length > 0) {
            p = splicedPeers.pop();
            for (i = 0; i < peersLength; i++)
                if (p.id == peers[i].id)
                    continue add_spliced;
            peers.push(p);
        }
    };

    var nextPeer = function() {
        // 1. Increase age of all peers and select to oldest to shuffle with
        var peer = increasePeerAgeAndRemoveOldest();
        if (peer !== false)
            return Q.resolve(peer);
        else
            return this.bootstrapController.nextFromBootstrap();
    };

    /*
     *  Initiates a new cyclon shuffle round according to the cyclon protocol.
     */
    var nextCycle = function(conn) {
        logger.debug("Executing nextCycle with " + conn.peer);
        var deferred = Q.defer();

        // 2. Select l − 1 other random neighbors.
        var numPeersToShuffle = Math.min(L - 1, peers.length);
        var splicedPeers = peers.randomSplice(numPeersToShuffle);

        // 3. Replace Q’s entry with a new entry of age 0 and with P’s id

        splicedPeers.push({
            id: this.commonData.me.id,
            age: 0,
            coord: this.vivaldiCoordinate.coord(),
            upload: this.commonData.uploadSpeedBps
        });

        // 4. Send the updated subset to peer Q.
        var timestamp = Date.now();
        var req = {
            prot: LABEL,
            type: REQUEST,
            shuffleList: splicedPeers,
            token: timestamp
        };
        conn.send(req);

        // Remove own descriptor again
        splicedPeers.pop();

        // Set timeout for response
        setTimeout(function() {
            if (!deferred.promise.isFulfilled()) {
                logger.log("No response received from " + conn.peer);
                peers.remove(conn.peer);
            }
        }, CYCLON_REQUEST_TIMEOUT);

        var connOnData = function(res) {
            if (res.type == RESPONSE && res.token == timestamp) {
                logger.debug("Received response from " + conn.peer);
                // Add new peers to peer set and fill up with old peers if necessary
                addShuffledPeers.call(this, res.shuffleList, splicedPeers);
                conn.removeListener('data', connOnData);
                deferred.resolve();
            }
        };
        conn.on('data', connOnData);
        return deferred.promise.timeout(CYCLON_REQUEST_TIMEOUT);
    };

    var setVivalidCoord = function(peerId, coord) {
        var result = $.grep(peers, function(p) {
            return p.id == peerId;
        });
        if (result.length > 0) {
            result[0].coord = coord;
        }
    };

    var handleRequest = function(req) {
        logger.debug("Received request");

        // Select L random neighbors.
        var numPeersToShuffle = Math.min(L, peers.length);
        var shuffleList = peers.randomSplice(numPeersToShuffle);

        addShuffledPeers.call(this, req.shuffleList, shuffleList);

        return {
            prot: LABEL,
            type: RESPONSE,
            shuffleList: shuffleList,
            token: req.token,
        };
    };

    var reportDeadPeer = function(peer) {
        this.bootstrapController.reportDeadPeer(peer.id);
        peers.remove(peer);
    };

    /*
     * The returned object containing public attributes and methods
     */
    return {

        vivaldiCoordinate: undefined,
        commonData: undefined,
        bootstrapController: undefined,
        nextPeer: nextPeer,
        nextCycle: nextCycle,
        handleRequest: handleRequest,
        setVivalidCoord: setVivalidCoord,
        reportDeadPeer: reportDeadPeer,
        peers: function() {
            return peers;
        },
        label: LABEL
    };
};

PeerDash.di.CyclonProtocol.prototype = {
    constructor: PeerDash.di.CyclonProtocol
};
