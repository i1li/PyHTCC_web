function initializeTimeslotIndex(givenTime = null) {
    const sched = schedInfoUI(givenTime);
    const timeslots = sched.timeslots;
    const timeNow = givenTime || getTimeNow();
    currentTimeslotIndex = timeslots.findIndex(timeslot => timeslot.time > timeNow);
    if (currentTimeslotIndex === -1) {
        currentTimeslotIndex = 0;
    }
    return { sched , givenTime };
}
function populateTimeslotNav(timeslot, givenTime = null) {
    UI.holdTime = givenTime || timeslot.time;
    $('#hold-time').val(UI.holdTime);
    $('#next-cool-temp').val(timeslot.coolTemp);
    $('#next-heat-temp').val(timeslot.heatTemp);
}
function timeslotNavigation(direction) {
    const sched = schedInfoUI();
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
        populateTimeslotNav(newTimeslot);
    } else {
        populateTimeslotNav({ time: hourLater });
    }
    UI.holdTime = newTimeslot ? newTimeslot.time : hourLater;
}
$('#next-timeslot, #prev-timeslot').click(function() {
    const direction = $(this).attr('id') === 'next-timeslot' ? 'next' : 'prev';
    timeslotNavigation(direction);
    hasUIChanged();
});
