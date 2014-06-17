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

PeerDash.di.PeerDashContext = function() {
    "use strict";

    return {
        system: undefined,
        setup: function() {
            PeerDash.di.PeerDashContext.prototype.setup.call(this);

            this.system.mapClass('fragmentLoader', PeerDash.di.PeerFragmentLoader);

            this.system.mapSingleton('peerConnectionManager', PeerDash.di.PeerConnectionManager);
            this.system.mapSingleton('overlayController', PeerDash.di.OverlayController);
            this.system.mapSingleton('connectionPool', PeerDash.di.ConnectionPool);
            this.system.mapSingleton('vivaldiProtocol', PeerDash.di.VivaldiProtocol);
            this.system.mapSingleton('vivaldiCoordinate', PeerDash.di.Dim2DVivaldiCoordinate);
            this.system.mapSingleton('cyclonProtocol', PeerDash.di.CyclonProtocol);
            this.system.mapSingleton('closePeerExplorationManager', PeerDash.di.ClosePeerExplorationManager);
            this.system.mapSingleton('segmentManager', PeerDash.di.SegmentManager);
            this.system.mapSingleton('commonData', PeerDash.di.CommonData);
            this.system.mapSingleton('bootstrapController', PeerDash.di.BootstrapController);
            this.system.mapSingleton('bandwidthReporter', PeerDash.di.BandwidthReporter);
            this.system.mapSingleton('responsibilityCoordinator', PeerDash.di.ResponsibilityCoordinator);
            this.system.mapSingleton('stats', PeerDash.di.Stats);
            this.system.mapSingleton('neighbourManager', PeerDash.di.NeighbourManager);
        }
    };
};

PeerDash.di.PeerDashContext.prototype = new Dash.di.DashContext();
PeerDash.di.PeerDashContext.prototype.constructor = PeerDash.di.PeerDashContext;
