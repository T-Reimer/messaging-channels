const { MessageChannel } = require("worker_threads");
const assert = require("assert");
const { MessagingChannel } = require("../index");

describe("messaging-channels", function () {

    let port1 = null, port2 = null;
    /**
     * @type {MessagingChannel}
     */
    let channel1 = null;
    /**
     * @type {MessagingChannel}
     */
    let channel2 = null;

    before(function () {
        ports = new MessageChannel();
        port1 = ports.port1;
        port2 = ports.port2;

        channel1 = new MessagingChannel();
        channel2 = new MessagingChannel();

        // register channel 1
        port1.on("message", channel1.registerOnMessage());
        channel1.registerPostMessage((data) => {
            port1.postMessage(data);
        });

        // register channel 2
        port2.on("message", channel2.registerOnMessage());
        channel2.registerPostMessage((data) => {
            port2.postMessage(data);
        });
    });

    after(function () {
        port1.close();
        port2.close();
    });

    describe("api", function () {
        it("should trigger a event 1>2", function (done) {

            // add a listener for channel 2
            channel2.on("test", (event) => {
                try {
                    assert.deepEqual(event.data, { foo: "bar" });
                    done();
                } catch (err) {
                    done(err);
                }
            });

            //send a message from channel 1 to 2
            channel1.send("test", { foo: "bar" });
        });

        it("should trigger a event 2>1", function (done) {

            // add a listener for channel 2
            channel1.on("test", (event) => {
                try {
                    assert.deepEqual(event.data, { foo: "bar" });
                    done();
                } catch (err) {
                    done(err);
                }
            });

            //send a message from channel 1 to 2
            channel2.send("test", { foo: "bar" });

        });


        it("should fetch with data", function (done) {
            const name = "fetch-with-data";

            // add a listener for channel 2
            channel2.on(name, (event) => {
                event.send({ foo: "bar", a: 1 });
            });

            //send a message from channel 1 to 2
            channel1.fetch(name, { foo: "bar" })
                .then(async data => {
                    assert.deepEqual(data, { foo: "bar", a: 1 });
                    done();
                })
                .catch(done);

        });

        // should run the callback function exactly twice
        it("should run callback multiple times", function (done) {
            const name = "multiple-events";
            let run = false;

            // add a listener for channel 2
            channel2.on(name, (event) => {
                if (run) {
                    done();
                }
                run = true;
            });
            channel2.on(name, (event) => {
                if (run) {
                    done();
                }
                run = true;
            });

            //send a message from channel 1 to 2
            channel1.send(name, {});
        });

        it("unregister function", function (done) {
            const name = "multiple-events-then-unregister";

            // add a listener for channel 2
            const unregister = channel2.on(name, (event) => {
                done();
            });
            unregister();

            channel2.on(name, (event) => {
                done();
            });

            //send a message from channel 1 to 2
            channel1.send(name, {});

        });

        it("should check is fetch = true", function (done) {
            const name = "check-isfetch-true";

            channel1.on(name, (event) => {
                if (event.isFetch()) {
                    done();
                }
                event.send();
            });

            channel2.fetch(name, {});
        });

        it("should check is fetch = false", function (done) {
            const name = "check-isfetch-false";

            channel1.on(name, (event) => {
                if (!event.isFetch()) {
                    done();
                } else {
                    done(1);
                }
            });

            channel2.send(name, {});
        });
    });


    describe("errors", function () {

        // make channel1 return an error for a fetch request
        it("should throw an error on fetch", function (done) {
            const name = "should-throw-error";

            channel1.on(name, (event) => {
                event.reject(new Error("Test Error"));
            });

            channel2.fetch(name)
                .then(_ => done(new Error("Did not reject")))
                .catch(err => {
                    if (err.message === "Test Error") {
                        done();
                    } else {
                        done(err);
                    }
                })
        });

        it("should throw an error on from callback", function (done) {
            const name = "should-throw-error-callback";

            channel1.on(name, (event) => {
                throw new Error("Test Error");
            });

            channel2.fetch(name)
                .then(_ => done(new Error("Did not reject")))
                .catch(err => {
                    if (err.message === "Test Error") {
                        done();
                    } else {
                        done(err);
                    }
                })
        });

        it("should trigger custom callback error", function (done) {
            const name = "custom-callback-error";

            // set a custom callback error
            channel2.callbackError = (err) => {
                if (err.message === "Callback Error") {
                    done();

                    //clear the callback error
                    channel2.callbackError = () => { };
                } else {
                    done(err);
                }
            };

            channel2.on(name, () => {
                throw new Error("Callback Error");
            });

            channel1.send(name, {});

        });

        // force a timeout
        it("should timeout", function (done) {
            const name = "should-timeout";

            channel1.fetch(name, {}, { timeout: 15 })
                .then(() => { done(new Error("expected to throw timeout")) })
                .catch(err => {
                    if (err.name === "TimeOut") {
                        done();
                    } else {
                        done(err);
                    }
                })
        });
    });

    // verify that all of the availible options work as they should
    describe("register", function () {

        it("should allow a custom callback error", function () {
            const callbackError = (err) => { };

            const channel = new MessagingChannel({ callbackError, });

            assert.equal(channel.callbackError, callbackError);
        });
    })
});