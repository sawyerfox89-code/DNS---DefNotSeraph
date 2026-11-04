export class TetiInterval {
    intervalProgress = 0;
    intervalTime = 0;
    fn;
    autoIntervalId;
    
    constructor(fn, intervalTime) {
        this.fn = fn;
        this.intervalTime = intervalTime;
    }

    tick(dt) {
        this.intervalProgress += dt;
        if (this.intervalProgress >= this.intervalTime) {
            this.fn();
            this.intervalProgress = 0;
        }
    }

    startAuto() {
        this.autoIntervalId = setInterval(this.fn, this.intervalTime);
        return this;
    }

    stopAuto() {
        clearInterval(this.autoIntervalId);
        return this;
    }
}

export class TetiTimeout {
    timeoutProgress = 0;
    timeoutTime = 0;
    fn;
    autoTimeoutId;
    
    constructor(fn, timeoutTime) {
        this.fn = fn;
        this.timeoutTime = timeoutTime;
    }

    tick(dt) {
        this.timeoutProgress += dt;
        if (this.timeoutProgress >= this.timeoutTime) this.fn();
    }

    startAuto() {
        this.autoTimeoutId = setTimeout(this.fn, this.timeoutTime);
        return this;
    }

    stopAuto() {
        clearTimeout(this.autoTimeoutId);
        return this;
    }
}
