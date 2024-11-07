function initializeTimeslotIndex(givenTime = null) {
    const sched = getUIScheduleInfo(givenTime);
    const timeslots = sched.timeslots;
    const timeNow = givenTime || getTimeNow();
    currentTimeslotIndex = timeslots.findIndex(timeslot => timeslot.time > timeNow);
    if (currentTimeslotIndex === -1) {
        currentTimeslotIndex = 0;
    }
}
function populateTimeslotNavigation(timeslot) {
    UI.holdUntil = timeslot.time;
    $('#hold-until').val(timeslot.time);
    $('#next-cool-temp').val(timeslot.coolTemp);
    $('#next-heat-temp').val(timeslot.heatTemp);
}
function timeslotNavigation(direction) {
    const sched = getUIScheduleInfo();
    const timeslots = sched.timeslots;
    const hourLater = getHourLater();
    if (currentTimeslotIndex === -1) {
        initializeTimeslotIndex();
    }
    if (direction === 'next') {
        currentTimeslotIndex = (currentTimeslotIndex + 1) % timeslots.length;
    } else {
        currentTimeslotIndex = (currentTimeslotIndex - 1 + timeslots.length) % timeslots.length;
    }
    const newTimeslot = timeslots[currentTimeslotIndex];
    if (newTimeslot) {
        populateTimeslotNavigation(newTimeslot);
    } else {
        populateTimeslotNavigation({ time: hourLater });
    }
    UI.holdUntil = newTimeslot ? newTimeslot.time : hourLater;
}
$('#next-timeslot, #prev-timeslot').click(function() {
    const direction = $(this).attr('id') === 'next-timeslot' ? 'next' : 'prev';
    timeslotNavigation(direction);
});
