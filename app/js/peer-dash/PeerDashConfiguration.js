PeerDash.conf = {
    'peerServer': 'localhost',
    'peerServerPort': 9000,
    'peerServerKey': 'peerjs',
    'iceServers': [{
        'url': 'stun:stun.l.google.com:19302'
    }],
    'bootstrapServer': 'http://localhost:8000',
    'statsServer': 'ws://localhost:10000'
};