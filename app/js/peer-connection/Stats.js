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

PeerDash.di.Stats = function() {
    "use strict";
    var logger = new PeerDash.Logger("STATS", {
        debug: true
    });

    logger.debug("PeerDash.di.Stats instantiated");

    var GLOBAL_STATS_POLLING_INTERVAL = 1000;

    var ws,
        queue = [];


    var createWebSocket = function() {
        var self = this;
        ws = new WebSocket(PeerDash.conf.statsServer);

        ws.onopen = function() {
            logger.debug("WebSocket to stats server is open");
            send({
                type: 'registration',
                id: self.commonData.me.id
            });
            setInterval(function() {
                    send({
                        type: 'ping'
                    });
                },
                20 * 1000
            );
        };

        ws.onmessage = function(evt) {
            try {
                var msg = JSON.parse(evt.data);
                if (msg.type == 'global-stats')
                self.commonData.globalStats = msg;
            } catch (error) {
                logger.log('Received a message which was not JSON encoded: ' + evt.data + ', error: ' + error);
            }
        };

        ws.onclose = function() { // websocket is closed. };

        };
    };

    var startPollingGlobalStats = function() {
        setInterval(getGlobalStats.bind(this), GLOBAL_STATS_POLLING_INTERVAL);
    };

    var getGlobalStats = function() {
        send({
            type: 'global-stats'
        });
    };

    var reportFromServer = function(reason) {
        send({
            type: 'stats',
            source: 'server',
            reason: reason
        });
    };

    var reportFromPeer = function() {
        send({
            type: 'stats',
            source: 'peer'
        });
    };

    var reportDryBuffer = function(media) {
        send({
            type: 'dry-buffer',
            media: media
        });
    };

    var reportNoDataReason = function(reason) {
        send({
            type: 'no-data',
            reason: reason
        });
    };

    var send = function(msg) {
        if (ws && ws.readyState === ws.OPEN)
            ws.send(JSON.stringify(msg));
        else if (ws && ws.readyState === ws.CONNECTING)
            queue.push(msg);
        else { // CLOSING or CLOSED
            ws = new WebSocket(PeerDash.conf.statsServer);
            queue.push(msg);
            ws.onopen = function() {
                logger.debug("WebSocket to stats server is reopened");
                while (queue.length > 0)
                    ws.send(JSON.stringify(queue.shift()));
            };
        }
    };

    return {
        commonData: undefined,
        createWebSocket: createWebSocket,
        startPollingGlobalStats: startPollingGlobalStats,
        reportFromServer: reportFromServer,
        reportFromPeer: reportFromPeer,
        reportDryBuffer: reportDryBuffer,
        reportNoDataReason: reportNoDataReason
    };
};

PeerDash.di.Stats.prototype = {
    constructor: PeerDash.di.Stats
};
