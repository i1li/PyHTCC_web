const IntervalManager = (function() {
    let lastEventTime = 0;
    let nextEventTime = 0;
    let timeoutId = null;
    let hurryRequested = false;
    let repeatHurryRequests = 0;
    let lastHurryTime = 0;
    const defaultMinInterval = 50000;
    const hurryMinInterval = 15000;
    function scheduleInterval() {
        const now = Date.now();
        const timeSinceLastEvent = now - lastEventTime;
        const maxInterval = timeToMinuteStart = 60000 - (now % 60000);
        let interval;
        if (hurryRequested) {
            const hurryInterval = hurryMinInterval * Math.pow(2, repeatHurryRequests);
            interval = Math.max(hurryInterval - timeSinceLastEvent, 0);
        } else if (maxInterval >= defaultMinInterval) {
            interval = maxInterval;
        } else {
            interval = defaultMinInterval;
        }
        nextEventTime = now + interval;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(processEvent, interval);
    }
    function processEvent() {
        const now = Date.now();
        eventChain();
        lastEventTime = now;
        hurryRequested = false;
        repeatHurryRequests = 0;
        scheduleInterval();
    }
    return {
        start: function() {
            processEvent();
        },
        hurry: function() {
            const now = Date.now();
            if (!hurryRequested) {
                hurryRequested = true;
                if (now - lastHurryTime < defaultMinInterval) { 
                    repeatHurryRequests = Math.min(repeatHurryRequests + 1, 2); 
                } else {
                    repeatHurryRequests = 0;
                }
                lastHurryTime = now;
                clearTimeout(timeoutId);
                scheduleInterval();
            }
        }
    };
})();
