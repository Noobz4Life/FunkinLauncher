var os = require('os');

if (os.platform() === 'win32') {
    var release = os.release();
    var version = parseInt(release.split('.')[0]);
    
    if (version >= 10) {
        var app = require('./Main');
    } else {
        process.exit(1203);
    }
} else { // Allow other platforms. We give a warning in Main.js for platforms that aren't Windows (see first few lines in the app.whenReady hook in Main.js)
    var app = require('./Main');
}