import i18next from '@/localization/config'

class EventEmitter {
    events: Record<string, Function[]> = {}
    constructor() {
        this.events = Object.create(null);
    }

    on(event: string, callback: Function) {
        if (typeof event !== 'string') {
        throw new TypeError(i18next.t('eventEmitter.tipString'));
        }
        if (typeof callback !== 'function') {
        throw new TypeError(i18next.t('eventEmitter.tipFunction'));
        }

        if (!this.events[event]) {
        this.events[event] = [];
        }

        if (!this.events[event].includes(callback)) {
        this.events[event].push(callback);
        }

        return this;
    }

    once(event: string, callback: Function) {
        const wrapper = (...args: any[]) => {
        callback(...args); 
        this.off(event, wrapper);
        };

        wrapper.originalCallback = callback;

        this.on(event, wrapper);
        return this;
    }

    emit(event: string, ...args: any[]) {
        if (!this.events[event]) {
        return false;
        }

        const callbacks = [...this.events[event]];

        callbacks.forEach(callback => {
        callback.apply(this, args);
        });

        return true;
    }

    off(event: string, callback: Function) {
        if (!this.events[event]) {
        return this;
        }

        if (typeof callback === 'undefined') {
        this.events[event] = [];
        return this;
        }

        this.events[event] = this.events[event].filter(fn => {
            return fn !== callback;
        });

        return this;
    }

    removeAllListeners(event?: string) {
        if (event) {
        if (this.events[event]) {
            this.events[event] = [];
        }
        } else {
        this.events = Object.create(null);
        }
        return this;
    }

    listenerCount(event: string) {
        return this.events[event] ? this.events[event].length : 0;
    }

    listeners(event: string) {
        return this.events[event] ? [...this.events[event]] : [];
    }
}

export default new EventEmitter;