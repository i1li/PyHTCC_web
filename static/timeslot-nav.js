function initializeTimeslotIndex() {
    const sched = getUIScheduleInfo();
    const timeslots = sched.timeslots;
    const currentTime = getCurrentTime();
    currentTimeslotIndex = timeslots.findIndex(timeslot => timeslot.time > currentTime);
    if (currentTimeslotIndex === -1) {
        currentTimeslotIndex = 0;
    }
}
function populateTimeslotNavigation(timeslot) {
    $('#next-heat-temp').val(timeslot.heatTemp);
    $('#next-cool-temp').val(timeslot.coolTemp);
    $('#hold-until').val(timeslot.time);
    UI.holdUntil = timeslot.time;
    checkForChanges();
}
function timeslotNavigation(direction) {
    const sched = getUIScheduleInfo();
    const timeslots = sched.timeslots;
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
        populateTimeslotNavigation({ time: getOneHourLaterTime() });
    }
    UI.holdUntil = newTimeslot ? newTimeslot.time : getOneHourLaterTime();
}
$('#next-timeslot, #prev-timeslot').click(function() {
    const direction = $(this).attr('id') === 'next-timeslot' ? 'next' : 'prev';
    timeslotNavigation(direction);
});
