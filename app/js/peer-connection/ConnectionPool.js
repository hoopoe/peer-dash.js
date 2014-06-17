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

PeerDash.di.ConnectionPool = function() {
    "use strict";
    var logger = new PeerDash.Logger("CONNPOOL", {
        debug: true
    });

    logger.debug("PeerDash.di.ConnectionPool instantiated");

    var PEER_CONNECT_TIMEOUT = 2000;

    var VIVALDI_INTERVAL = 888;

    var REQUEST = 'REQUEST',
        NOTIFICATION = 'NOTIFICATION',
        LABEL = 'CONNPOOL';

    var connections = {},
        requestHandlers = {};


    var addEventListeners = function(conn) {
        conn.on('data', function(req) {
            if (req.type == REQUEST) {
                logger.debug("Received request from " + conn.peer);
                conn.send(requestHandlers[req.prot](req, conn));
            } else if (req.type == NOTIFICATION) {
                requestHandlers[req.prot](req, conn);
            }
        });
        conn.once('error', function() {
            logger.log("Connection could not be established to " + conn.peer);
            conn.removeAllListeners();
            conn.close();
            delete connections[conn.peer];
        });
        conn.once('close', function() {
            logger.debug("Connection with " + conn.peer + " closed");
            conn.removeAllListeners();
            delete connections[conn.peer];
        });
    };

    /*
     * Return an existing connection or creates a new
     */
    var connect = function(peerId) {
        var conn = connections[peerId];
        if (conn !== undefined && conn.open)
            return Q.resolve(conn);

        var deferred = Q.defer();
        if (conn !== undefined && !conn.open) {
            conn.once('open', function() {
                deferred.resolve(conn);
            });
        } else {
            conn = this.commonData.me.connect(peerId, {
                label: LABEL
            });
            connections[peerId] = conn;
            conn.once('open', function() {
                logger.log("Now connected to " + conn.peer);
                deferred.resolve(conn);
            });
            addEventListeners.call(this, conn);
        }
        return deferred.promise.timeout(PEER_CONNECT_TIMEOUT);
    };

    var closeConnection = function(conn) {
        conn.close();
        conn.removeAllListeners();
        delete connections[conn.peer];
    };

    var closeConnectionById = function(id) {
        var conn = connections[id];
        conn.close();
        conn.removeAllListeners();
        delete connections[id];
    };

    var handleConnection = function(conn) {
        connections[conn.peer] = conn;
        addEventListeners.call(this, conn);
    };

    var start = function() {
        setInterval(
            executeVivaldi.bind(this),
            VIVALDI_INTERVAL
        );
    };

    var executeVivaldi = function() {
        var length = Object.keys(connections).length;
        if (length > 0) {
            var peerId = Object.keys(connections)[Math.floor(Math.random() * length)];
            var conn = connections[peerId];
            if (conn.open)
                this.vivaldiProtocol.nextCycle(conn);
        }
    };

    return {
        commonData: undefined,
        vivaldiProtocol: undefined,
        setRequestHandler: function(prot, handler) {
            requestHandlers[prot] = handler;
        },
        getConnectionHandler: function() {
            return handleConnection.bind(this);
        },
        closeConnection: closeConnection,
        closeConnectionById: closeConnectionById,
        connect: connect,
        label: LABEL,
        getNumberOfConnections: function() {
            return Object.keys(connections).length;
        },
        start: start
    };
};

PeerDash.di.ConnectionPool.prototype = {
    constructor: PeerDash.di.ConnectionPool
};
