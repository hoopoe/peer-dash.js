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

PeerDash.di.ResponsibilityCoordinator = function() {
    "use strict";
    var logger = new PeerDash.Logger("RESPCOORD", {
        debug: false
    });

    logger.debug("PeerDash.di.ResponsibilityCoordinator instantiated");

    var HIGHEST_RF = 16,
        previusRequestedVideoBitrate = 0,
        previusRequestedAudioBitrate = 0;

    var calculateResponsibility = function(toFetch) {

        var peers = this.neighbourManager.getOutboundPeers();
        // Gets the current bandwidth of requested segment
        var bitrate = this.metricsExt.getBandwidthForRepresentation(toFetch.repId);
        logger.debug(toFetch.url + " Using representationId: " + toFetch.repId + " " + bitrate + " bps");

        var rf = HIGHEST_RF * 2,
            totalUpload = 0,
            summedBitrate,
            segmentNumber = toFetch.index,
            totalUploadCapacity,
            requiredUploadCapacity = 0,
            responsiblePeers,
            i;

        var peerMe = {id: this.commonData.me.id, upload: this.commonData.uploadSpeedBps};
        peers = peers.concat(peerMe);

        for (i = 0; i < peers.length; i++) {
            totalUpload += peers[i].upload;
        }
        var avgUpload = totalUpload / peers.length;
        var superPeerLimit = avgUpload * 2;

        if (toFetch.streamType === "video") {
            summedBitrate = previusRequestedAudioBitrate + bitrate;
            previusRequestedVideoBitrate = bitrate;
        } else if (toFetch.streamType === "audio") {
            summedBitrate = previusRequestedVideoBitrate + bitrate;
            previusRequestedAudioBitrate = bitrate;
        }

        logger.debug("Summed bitrate is: " + summedBitrate);


        while (rf > 1) {
            rf /= 2;
            totalUploadCapacity = 0;
            responsiblePeers = [];
            requiredUploadCapacity = summedBitrate * peers.length;

            for (i = 0; i < peers.length; i++) {
                var p = {
                    id: peers[i].id,
                    upload: peers[i].upload
                };

                if (p.id % rf == segmentNumber % rf || p.upload >= superPeerLimit) {
                    totalUploadCapacity += p.upload;
                    requiredUploadCapacity -= summedBitrate;
                    p.responsible = true;
                    responsiblePeers.push(p);
                    if (p.upload >= superPeerLimit)
                        p.superPeer = true;
                } else {
                    p.responsible = false;
                }
            }
            if (totalUploadCapacity >= requiredUploadCapacity)
                break;
        }

        logger.debug("avgUpload: " + avgUpload);
        logger.debug("superPeerLimit: " + superPeerLimit);
        logger.debug("segmentNumber: " + segmentNumber);
        logger.debug("rf: " + rf);
        logger.debug("totalUploadCapacity: " + totalUploadCapacity);
        logger.debug("requiredUploadCapacity: " + requiredUploadCapacity);

        responsiblePeers.sort(function(a, b) { return a.upload > b.upload; } );
        calculateRespValue(responsiblePeers);
        logger.debug("peers: " + JSON.stringify(responsiblePeers, null, 2));
        // TODO: remove self with removeId
        peers.remove(peerMe);
        // peers.removeId(this.commonData.me.id);
        return responsiblePeers;
    };

    var calculateRespValue = function(peers) {
        var prevRespValue = 0;
        peers.forEach(function(peer){
            peer.respValue = Math.floor(peer.upload + prevRespValue);
            prevRespValue = peer.respValue;
        });
    };

    return {
        commonData: undefined,
        metricsExt: undefined,
        neighbourManager: undefined,
        calculateResponsibility: calculateResponsibility,
        calculateRespValue: calculateRespValue
    };
};

PeerDash.di.ResponsibilityCoordinator.prototype = {
    constructor: PeerDash.di.ResponsibilityCoordinator
};
