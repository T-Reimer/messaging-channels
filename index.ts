interface MessagingChannelOptions {
    callbackError: (err: Error) => void;
}

interface FetchOptions {
    /**
     * Set the timeout amount
     */
    timeout: number,
}

/**
 * The envelope to send the data to the message channel
 */
interface MessageData {
    id: number | null,
    name: string | null,
    data: any,
    error?: {
        name: string,
        message: string,
    }
    options?: Partial<FetchOptions>,
}

/**
 * Callback function to register for a event
 */
type CallbackFunction = (event: MsgEvent) => void;


export class MessagingChannel {
    /**
     * the next fetch request id
     */
    public nextId = 0;

    /**
     * The list of listeners active
     */
    public listeners: ({ name: string, callbacks: CallbackFunction[] })[] = [];

    /**
     * The list of waiting promises to resolve
     */
    public waiting: ({ id: number, resolve: (data: any) => void, reject: (err: Error) => void })[] = [];

    public _postMessage: (data: MessageData) => void = () => { console.warn("Please register the post message callback function with '.registerPostMessage(callback)'.") };

    /**
     * This function will run if there is a uncaught error from a callback function
     * 
     * @param err 
     */
    public callbackError = (err: Error) => console.error("Callback Error", err);


    constructor(public options?: Partial<MessagingChannelOptions>) {

        // set the callback error function
        if (options?.callbackError && typeof options.callbackError === "function") {
            this.callbackError = options.callbackError
        }

    }

    /**
     * Returns the function to run each time a message is received to execute the callbacks
     */
    registerOnMessage() {
        return (msg: MessageData) => {

            if (typeof msg.id === "number" && msg.name === null) {
                // is a fetch response
                for (const event of this.waiting) {
                    // find the registered callback to resolve the promise
                    if (event.id === msg.id) {

                        // if an error happened then reject the promise
                        if (msg.error) {
                            let err = new Error(msg.error.message);
                            err.name = msg.error.name;

                            event.reject(err);
                        } else {
                            // resolve the promise with the given data
                            event.resolve(msg.data);
                        }
                        // exit the loop and function
                        return;
                    }
                }

            } else {
                const event = new MsgEvent(this, msg.id, (msg.name as string), msg.data, msg.options);

                // fire all of the on event listeners
                for (const listener of this.listeners) {
                    // find the event
                    if (listener.name === event.name) {

                        for (const callback of listener.callbacks) {
                            try {

                                callback(event);

                            } catch (err) {
                                // the id is a number then its a fetch request... Send back the error
                                if (typeof event.id === "number") {
                                    event.reject(err);
                                } else {
                                    this.callbackError(err);
                                }
                            }
                        }

                        // break out of the loop
                        break;
                    }
                }
            }
        };
    }

    /**
     * Register the callback to run to send the messages.
     * 
     * the callback function gets 1 parameter set that should get sent to the Message channel
     * 
     * @param callback function that gets executed
     */
    registerPostMessage(callback: (data: MessageData) => void) {
        this._postMessage = callback;
    }

    /**
     * Directly sends the data to the other channel listeners
     */
    postMessage(msg: MessageData) {
        this._postMessage(msg);
    }

    /**
     * Register a listener for api request name
     * 
     * @param name the api name to register as listener
     */
    on(name: string, callback: CallbackFunction) {
        let added = false;

        for (const listener of this.listeners) {
            if (listener.name === name) {
                // add the callback to the listener
                listener.callbacks.push(callback);
                added = true;
                break;
            }
        }

        // create a new listener group and add the callback
        if (!added) {
            this.listeners.push({
                name,
                callbacks: [callback],
            })
        }

        // return a function to unregister the event
        return () => {
            // loop over all of the listeners to unregister the callback
            for (const listener of this.listeners) {
                if (listener.name === name) {
                    // unregister the callback function
                    for (let i = listener.callbacks.length - 1; i >= 0; i--) {
                        if (listener.callbacks[i] === callback) {
                            listener.callbacks.splice(i, 1);
                            break;
                        }
                    }
                    break;
                }
            }
        };
    }

    /**
     * Send a fetch request over the message channel
     * 
     * @param name the api name that is registered on the other side
     * @param data the data to send over
     * @param options the options to use
     */
    fetch(name: string, data: any, options?: Partial<FetchOptions>): Promise<any> {
        return new Promise((resolve, reject) => {
            let id = this.nextId++;

            // add the callbacks to the waiting stack
            this.waiting.push({
                resolve,
                reject,
                id,
            });

            // send the data
            this.postMessage({
                id,
                data,
                name,
                options: typeof options === "undefined" ? {} : options,
            });

            if (options && options.timeout) {
                setTimeout(() => {

                    // reject the promise
                    const err = new Error("Timed out.");
                    err.name = "TimeOut";
                    reject(err);

                    // remove the waiting event from callback stack
                    for (let i = this.waiting.length - 1; i >= 0; i--) {
                        if (this.waiting[i].id === id) {
                            this.waiting.splice(i, 1);
                            break;
                        }
                    }

                }, options.timeout);
            }
        });
    }

    /**
     * Send some data over the message channel
     * 
     * @param name 
     * @param data 
     */
    send(name: string, data: any) {

        // send the data message
        this.postMessage({
            id: null,
            data,
            name,
            options: {},
        });
    }
}

export default MessagingChannel;


class MsgEvent {
    options: Partial<FetchOptions>;

    constructor(public channel: MessagingChannel, public id: number | null, public name: string, public data: any, options?: Partial<FetchOptions>) {
        this.options = typeof options === "undefined" ? {} : options;
    }

    /**
     * Tells if this event was started by a fetch request that is expecting a answer back or if it was a simple send message
     */
    isFetch() {
        return typeof this.id === "number";
    }

    /**
     * Reject this current event
     * 
     * Sends a reject message to the fetch request and the fetch request will throw the error
     * 
     * @param err the error to send
     */
    reject(err: Error) {
        this.channel.postMessage({
            id: this.id,
            error: {
                name: err.name,
                message: err.message,
            },
            data: null,
            name: null,
        });
    }

    /**
     * Respond to the fetch request with data
     * 
     * @param data the data to send to the fetch request
     */
    send(data: any) {

        // send the response data back
        this.channel.postMessage({
            id: this.id,
            data: data,
            name: null,
        });
    }
}