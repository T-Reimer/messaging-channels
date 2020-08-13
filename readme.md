# messaging-channels

Provides a way to send requests using existing message channels.

This is useful for places such as webworkers, node worker_threads or even websocket connections.

## Basic Example:

*Imagine `port1` as the html page setting up a webworker and `port2` as the web worker itself.*

    const {MessageChannel} = require("worker_threads");
    const {MessagingChannel} = require("messaging-channels");
    
    const {port1, port2} = new MessageChannel();
    
    // setup the channels for the first side of the js MessageChannel
    const channel1 = new MessagingChannel();
	port1.on("message", channel1.registerOnMessage());
	channel1.registerPostMessage(data => port1.postMessage(data));

    const channel2 = new MessagingChannel();
    port2.on("message", channel2.registerOnMessage());
    channel2.registerPostMessage(data => port2.postMessage(data));

After that setup you can now register a listener on either side and then fetch or send data.

	channel1.on("test-event", (event) => {
		let val = 2 * event.data;
		if(event.isFetch()){
			event.send(val);
		} else{
			console.log(val);
		}
	});

Now send or fetch some data from channel2
		
	channel2.send("test-event", 4); // console output: 8
	channel2.fetch("test-event", 6).then(val =>{})// val is equal to 12 


> Written with [StackEdit](https://stackedit.io/).