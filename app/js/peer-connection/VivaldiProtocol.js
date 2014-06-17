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

PeerDash.di.VivaldiProtocol = function() {
    "use strict";
    var logger = new PeerDash.Logger("VIVPROT", {
        debug: false
    });
    logger.debug("PeerDash.di.VivaldiProtocol instantiated");

    /*
     * Timeouts
     */
    var VIVALDI_REQUEST_TIMEOUT = 3000;

    /*
     * Constants
     */
    var REQUEST = 'REQUEST',
        RESPONSE = 'RESPONSE',
        LABEL = 'VIVALDI',
        UNCERTAINTY_FACTOR = 0.5,
        CORRECTION_FACTOR = 0.5;

    /*
     * Member variables
     */
    var uncertainty = 1;

    /*
     * Methods
     */
    var nextCycle = function(conn) {
        var self = this;
        logger.debug("Executing nextCycle with " + conn.peer);
        var deferred = Q.defer();

        var timestamp = Date.now();
        var request = {
            prot: LABEL,
            type: REQUEST,
            token: timestamp
        };
        conn.send(request);

        var connOnData = function(res) {
            if (res.type == RESPONSE && res.token == timestamp) {
                logger.debug("Received response from " + conn.peer);
                // Calculate the RTT
                var rtt = Date.now() - timestamp;
                logger.debug("RTT: " + rtt);
                // Calculate the distance which is the estimated RTT
                var est_rtt = self.vivaldiCoordinate.distance(res.coord);
                logger.debug("Estimated RTT: " + est_rtt);
                // Calculate the error in estimation of RTT (can be negative)
                var error = rtt - est_rtt;
                logger.debug("Error in RTT: " + error);
                // Calculate the relative error in estimation of RTT
                var relative_error = Math.abs(error) / rtt;
                logger.debug("Relative error in RTT: " + relative_error);
                // Calculate the uncertainty balance between the two nodes
                var uncertainty_balance = uncertainty / (uncertainty + res.uncertainty);
                logger.debug("Uncertainty balance: " + uncertainty_balance);
                // Calculate new uncertainty with respect to relative error and uncertainty balance
                uncertainty = (relative_error * UNCERTAINTY_FACTOR * uncertainty_balance) + (uncertainty * (1 - UNCERTAINTY_FACTOR * uncertainty_balance));
                logger.debug("New uncertainty: " + uncertainty);
                // Vector representing the distance in estimated coordinates
                var vector = self.vivaldiCoordinate.differenceVector(res.coord);
                logger.debug("Difference vector: " + JSON.stringify(vector.components()));
                // Normalize vector, i.e. set length to 1
                vector.normalize();
                logger.debug("Normalized vector: " + JSON.stringify(vector.components()));
                // Apply (the possibly negative) error to calculate the force vector
                vector.applyError(error);
                logger.debug("Vector with error applied: " + JSON.stringify(vector.components()));
                // Adapt force vecor with the correction factor and the uncertainty balance before applying it to the estimated coordinates
                self.vivaldiCoordinate.applyForceVector(vector, CORRECTION_FACTOR, uncertainty_balance);
                logger.debug("New coordinate: " + JSON.stringify(self.vivaldiCoordinate.coord()));
                // Remove listener
                conn.removeListener('data', connOnData);
                // Resolove promise
                deferred.resolve();
                // Set vivaldi coordinate for other peer in cyclon
                self.cyclonProtocol.setVivalidCoord(conn.peer, res.coord);
            }
        };
        conn.on('data', connOnData);
        return deferred.promise.timeout(VIVALDI_REQUEST_TIMEOUT);
    };

    var handleRequest = function(req) {
        logger.debug("Received request");
        return {
            prot: LABEL,
            type: RESPONSE,
            token: req.token,
            coord: this.vivaldiCoordinate.coord(),
            uncertainty: uncertainty
        };
    };

    /*
     * Exposed attributes and methods
     */
    return {
        vivaldiCoordinate: undefined,
        cyclonProtocol: undefined,
        nextCycle: nextCycle,
        handleRequest: handleRequest,
        label: LABEL
    };
};

PeerDash.di.VivaldiProtocol.prototype = {
    constructor: PeerDash.di.VivaldiProtocol
};
