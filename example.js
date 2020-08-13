const { MessageChannel } = require("worker_threads");
const { MessagingChannel } = require("./index");

const { port1, port2 } = new MessageChannel();

// setup the channels for the first side of the js MessageChannel
const channel1 = new MessagingChannel();
port1.on("message", channel1.registerOnMessage());
channel1.registerPostMessage(data => port1.postMessage(data));

const channel2 = new MessagingChannel();
port2.on("message", channel2.registerOnMessage());
channel2.registerPostMessage(data => port2.postMessage(data));

channel1.on("test-event", (event) => {
    let val = 2 * event.data;
    if (event.isFetch()) {
        event.send(val);
    } else {
        console.log({ val });
    }
});

channel2.send("test-event", 4); // console output: 8
channel2.fetch("test-event", 6).then(val => { console.log(val) })// val is equal to 12 

setTimeout(() => {
    port2.close();
    port1.close();
}, 1000);