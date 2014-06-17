var connect = require('connect');
var serveStatic = require('serve-static');

var app = connect();

var port = process.env.PORT || 5000;

app.use(serveStatic('app'));

app.listen(port, function() {
    console.log("Server listening on port " + port);
});
