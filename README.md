# IPM - Inter Process Messenger

Simple implementation for inter-process messages transfer using named pipes (currently only on windows).

## Server Side

Creating a server named *example*:

```javascript
var ipm = require('ipm');

var server = ipm.createServer('example');

server.listen();
```

Handling messages:

```javascript
server.on('message', function (message, connection) {
    console.log('Message:\n' +
      Object.keys(message).map(function (key) { return key + '=' + message[key]; }).join('\n'));
    connection.send({response: "Got it"});
});
```

## Client Side

Connecting to a server named *example*:

```javascript
var ipm = require('ipm');

var connection = ipm.connect('example');
```

Sending and handling messages:

```javascript
connection.on('message', function (message) {
    console.log(message);
});

connection.send({ex: "ample"});
```

Also possible:

```javascript
var connection = ipm.connect('example', function (message) { 
    console.log(message);
    connection.send({message: "received"}); 
});
```

Sending a message and handling one message received:
```javascript
connection.send({ex: "ample"}, function (response) {
    console.log(response);
});
```
