var events = require('events'),
    util = require('util'),
    fs = require('fs'),
    net = require('net');

function getPipePath(name) {
    return process.platform === "win32"
        ? '\\\\.\\pipe\\' + name
        : '/tmp/' + name + '.ipm';
}

function processMessages(connection, callback) {
    while (connection._buffer.length > 4) {
        var length = connection._buffer.readUInt32LE(0);
        if (connection._buffer.length < length + 4) {
            break;
        }
        var messageText = connection._buffer.slice(4, length + 4).toString();
        connection._buffer = connection._buffer.slice(4 + length);
        try {
            var message = JSON.parse(messageText);
            callback(message);
            //ipm.emit('message', message, connection);
        }
        catch (err) {
            // TODO - error on parse?
        }
    }
}

function MessageConnection(name, callback) {
    // No name - stream and messaging is handle by message server
    if (name) {
        var connection = this;
        if (callback) {
            connection.on('message', callback);
        }
        connection._stream = net.connect(getPipePath(name));
        connection._stream.on('data', function (b) {
            if (connection._buffer) {
                connection._buffer = Buffer.concat([connection._buffer, b]);
            }
            else {
                connection._buffer = b;
            }

            processMessages(connection, function (message) {
                connection.emit('message', message);
            });
        });

        connection._stream.on('end', function () {
            connection._stream = null;
            connection.emit('end');
        });
    }
}


util.inherits(MessageConnection, events.EventEmitter);

MessageConnection.prototype.send = function (message, callback) {
    var messageBuffer = Buffer.from(JSON.stringify(message));
    var buffer = Buffer.alloc(4 + messageBuffer.length);
    buffer.writeUInt32LE(messageBuffer.length, 0);
    messageBuffer.copy(buffer, 4);
    if (callback) {
        this.once('message', callback);
    }
    this._stream.write(buffer);
};

MessageConnection.prototype.close = function () {
    this._stream.end();
    this._stream = null;
};

function MessageServer(name) {
    var messageServer = this;
    this._name = name;
    this._server = net.createServer(function (stream) {
        var connection = new MessageConnection();
        connection._stream = stream;

        messageServer.emit('connection', connection);

        stream.on('data', function (b) {
            if (connection._buffer) {
                connection._buffer = Buffer.concat([connection._buffer, b]);
            }
            else {
                connection._buffer = b;
            }

            processMessages(connection, function (message) {
                messageServer.emit('message', message, connection);
                connection.emit('message', message);
            });
        });
        stream.on('end', function () {
            connection._stream = null;
            messageServer.emit('end', connection);
            connection.emit('end');
        });
    });


}

MessageServer.prototype.listen = function (callback) {
    if (callback) {
        this.on('connection', callback);
    }
    var pipePath = getPipePath(this._name);
    // On linux - making sure there is no pipe file so that the listen will succeed
    if (process.platform !== "win32" && fs.existsSync(pipePath)) {
        fs.unlinkSync(pipePath);
    }
    this._server.listen(pipePath);
};

MessageServer.prototype.close = function (callback) {
    this._server.close(callback);
};

util.inherits(MessageServer, events.EventEmitter);

module.exports = {
    createServer: function (name) {
        return new MessageServer(name);
    },
    connect: function (name, callback) {
        return new MessageConnection(name, callback);
    }
};