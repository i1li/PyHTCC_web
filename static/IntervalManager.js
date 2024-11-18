class IntervalManager {
    constructor(defaultMinInterval = 50000, hurryInterval = 15000) {
        this.defaultMinInterval = defaultMinInterval;
        this.baseHurryInterval = hurryInterval;
        this.lastEventTime = 0;
        this.timeoutId = null;
        this.hurried = false;
        this.repeatHurryRequests = 0;
        this.lastHurryTime = 0;
    }
    calculateInterval() {
        const now = Date.now();
        const timeSinceLastEvent = now - this.lastEventTime;
        const nextMinuteStart = 60000 - (now % 60000);
        if (this.hurried) {
            const hurryInterval = this.baseHurryInterval * Math.pow(2, this.repeatHurryRequests);
            return Math.max(hurryInterval - timeSinceLastEvent, 0);
        } else {
            return Math.max(nextMinuteStart, this.defaultMinInterval);
        }
    }
    scheduleNext() {
        clearTimeout(this.timeoutId);
        const interval = this.calculateInterval();
        this.timeoutId = setTimeout(() => this.processEvent(), interval);
    }
    processEvent() {
        updateCycle();
        this.lastEventTime = Date.now();
        this.hurried = false;
        this.repeatHurryRequests = 0;
        this.scheduleNext();
    }
    start() {
        this.processEvent();
    }
    hurry() {
        const now = Date.now();
        if (!this.hurried) {
            this.hurried = true;
            if (now - this.lastHurryTime < this.defaultMinInterval) {
                this.repeatHurryRequests = Math.min(this.repeatHurryRequests + 1, 2);
            } else {
                this.repeatHurryRequests = 0;
            }
            this.lastHurryTime = now;
            this.scheduleNext();
        }
    }
}
const go = new IntervalManager();
