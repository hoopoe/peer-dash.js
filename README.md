# peer-dash.js

This is a peer assisted extension to the DASH IF Reference Client [dash.js](https://github.com/Dash-Industry-Forum/dash.js/).
It enables peer assisted fetching of segments for live video.
No plugins are needed to do this, only a modern browser which supports both Media Source Extensions and WebRTC.
Currently, only Google Chrome meets these criteria.

## Testing the player

The player can be tested by visiting `http://live-dash.herokuapp.com`.
Use the pre-loaded manifest address and press load.
Open up another tab and see how the two clients cooperate.

The player has a few but very important dependencies but as long as we have our services running, you can utilize them for trying out the player.

* The player depends on a PeerJS server to help peers connect to each other through WebRTC, i.e. helping in finding the IP address to another peer. This server does also provide a peer with an ID.

    Source: https://github.com/JYZR/peerjs-server

* The player also depends on a bootstrap server from which it gets its initial set of peers.

    Source: https://github.com/JYZR/peer-dash.js-bootstrap

* Another server collects statistics and presents the performance over the last 10 seconds.

	Source: https://github.com/JYZR/peer-dash.js-stats

* The live stream is set up with a static file server at the back but proxied through a server which lets clients find the live edge by sending 404 response for "future" segments.

	Source: https://github.com/JYZR/live-dash-server

* *Bandwith test*

Modify `PeerDashConfiguration.js` to change the addresses to these servers.

## Start a static file server locally

1. [Install node.js](http://nodejs.org/)
2. Install Connect: `npm install`
3. Start the file server: `npm start`
4. Visit `http://localhost:5000` from Chrome
