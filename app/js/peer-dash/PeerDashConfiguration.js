PeerDash.conf = {
    'peerServer': 'lajv-peerserver.herokuapp.com',
    'peerServerPort': 80,
    'peerServerKey': 'lajv',
    'iceServers': [{
        'url': 'stun:stun.l.google.com:19302'
    }],
    'bootstrapServer': 'http://lajv-bootstrap.herokuapp.com',
    'statsServer': 'ws://lajv-stats.herokuapp.com'
};
