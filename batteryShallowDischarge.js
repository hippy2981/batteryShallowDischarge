//{/////////////// debug /////////////////

// set true for debug logs
var debug = false;
function consolelog(data) {
    if (debug) {
        console.log(data);
    }
}

//}/////////////// debug /////////////////

consolelog('####Starting rule: batteryShallowDischarge####');

//{/////////////// settings /////////////////

// battery level limts
var lowerLimit = 40; //should be 5x
var upperLimit = 80; //should be 5x
var dischargedLimit = 5; //should be 5x
var chargedLimit = 100; //should be 5x
// notify interval in seconds
var notifyInterval = 10;
// last notification time
var lastNotified;
// key(s) used for local storage
var stateKey = 'bsd.cycle';

//}/////////////// settings /////////////////

//{/////////////// init /////////////////

init();
// Init.
function init(){
    // set lastNotified as now
    resetLastNotified();
    // reset cycle
    resetCycle('no force');
}

//}/////////////// init /////////////////

//{/////////////// events /////////////////

// updated event
device.battery.on('updated', function (status) {
    statusLog(status);
    // notify every 5% only and avoid hitting local storage every %
    if (status.percentage % 5 === 0) {
        var state = getState();
        checkToNotify(status, 'updated', state);
        updateState(status, state);
    }
});

// *Charging events
device.battery.on('startedCharging', function (status) {
    // notify to unplug
    checkToNotify(status, 'startedCharging');
});
device.battery.on('stoppedCharging', function (status) {
    // notify to plug
    checkToNotify(status, 'stoppedCharging');
});

//}/////////////// events /////////////////

//{/////////////// functions /////////////////

// Notify user to either fully charge/discharge if not doing so.
function checkToNotify(status, event, state) {
    state = state || getState();
    var isChargingEvent = event.indexOf('Charging') >= 0;
    var text = null;
    var isInCycle = isWithinCycle(state);
    var isCharged = 
        status.isCharging && status.percentage === chargedLimit;
    var isDischarged = 
        !status.isCharging && status.percentage === dischargedLimit;
    if (isCharged) {
        text = 'Unplug.';
    } else if (isDischarged) {
        text = 'Plug in.';
    } else if (!isInCycle && isChargingEvent) {
        // *Charging event
        if (status.isCharging) {
            text = 'Discharge fully.';
        }
    } else if (isInCycle) {
        // updated, *Charging events
        if (!status.isCharging &&
            (state.shallow === 'lower' || status.percentage <= lowerLimit)) {
            text = 'Plug in.';
        } else if (status.isCharging &&
            (state.shallow === 'upper' || status.percentage >= upperLimit)) {
            text = 'Unplug.';
        }
    }
    if (text && !isNotifiedRecently()) {
        notify(text, status);
    }
}

// Update the state to local storage.
function updateState(status, state) {
    consolelog('state (before): ' + stateLog());
    if (!isWithinCycle(state)) {
        // change state only if not within cycle 
        // (ex: accidental full charge/discharge within cycle)
        var isDischarged = 
            !status.isCharging && status.percentage === dischargedLimit;
        if (isDischarged) {
            resetCycle();
            consolelog('resetCycle()');
        }
    }
    if (status.percentage >= upperLimit) {
        if (state.shallow !== 'upper') {
            state.shallow = 'upper';
            setState(state);
            consolelog('shallow = upper');
        }
    } else if (status.percentage <= lowerLimit) {
        if (state.shallow !== 'lower') {
            state.shallow = 'lower';
            setState(state);
            consolelog('shallow = lower');
        }
    }
    consolelog('state (after): ' + stateLog());
}

// Notify.
function notify(text, status) {
    var content = 'Battery: ' + status.percentage + '%';
    if (status.testid) content += (' test#' + status.testid);
    var notification = device.notifications.createNotification(text);
    notification.content = content;
    notification.on('click', function() { });
    notification.show();
    consolelog('notify: ' + text + " | " + content);
    resetLastNotified();
}

// Returns true if in cycle.
function isWithinCycle(state) {
    var month = new Date().getMonth();
    var result = month === state.cycleMonth;
    consolelog('isWithinCycle: ' + result + ', month: ' + month);
    return result;
}

// Resets cycle in local storage.
function resetCycle(force, date) {
    force = force === undefined;
    date = date || new Date();
    if (force || !getState()) {
        var state = { cycleMonth: date.getMonth(), shallow: getShallow() };
        setState(state);
        consolelog('resetCycle. state: ' + stateLog());
    } else {
        consolelog('existing state: ' + stateLog());
    }
}

// Determine shallow value on battery status.
function getShallow(status) {
    status = status || device.battery.status;
    var uplo;
    if (status.percentage >= upperLimit) {
        uplo = 'upper';
    } else if (status.percentage <= lowerLimit) {
        uplo = 'lower';
    } else {
        // lower-upper range
        if (status.isCharging) {
            uplo = 'lower';
        } else {
            uplo = 'upper';
        }
    }
    statusLog(status);
    consolelog('getShallow: ' + uplo);
    return uplo;
}

// Get state from local storage.
function getState() {
    return JSON.parse(device.localStorage.getItem(stateKey));
}

// Set state to local storage.
function setState(state) {
    return device.localStorage.setItem(stateKey, JSON.stringify(state));
}

// Returns true if recently notified.
function isNotifiedRecently() {
    var seconds = (new Date().getTime() - lastNotified.getTime()) / 1000;
    return seconds <= notifyInterval;
}

// Resets last notified to now.
function resetLastNotified() {
    lastNotified = new Date();
}

// Get state for logging.
function stateLog(state) {
    state = state || getState();
    return JSON.stringify(state);
}

// Get status for logging.
function statusLog(status) {
    if (status.testid)
        consolelog('test#' + status.testid);
    consolelog('status: ' +
        'isCharging=' + status.isCharging + 
        ', percentage=' + status.percentage);
}

//}/////////////// functions /////////////////

consolelog('####Completed rule: batteryShallowDischarge####');

//{/////////////// tests /////////////////
/*

consolelog('tests start');

// get the old state to revert to after tests are run
var oldstate = getState();

notifyInterval = -1; // disable notifyInterval

// in cycle: notify only at 40 d/c and 80 c
setState({ cycleMonth: new Date().getMonth() });
device.battery.emit('updated', { testid: 1, percentage: lowerLimit, isCharging: true });
device.battery.emit('updated', { testid: 2, percentage: lowerLimit, isCharging: false });//notify to plug
device.battery.emit('updated', { testid: 3, percentage: upperLimit, isCharging: true });//notify to unplug
device.battery.emit('updated', { testid: 4, percentage: upperLimit, isCharging: false });

// NOT in cycle: no notify at 40 d/c and 80 c
setState({ cycleMonth: new Date().getMonth()-1 });
device.battery.emit('updated', { testid: 5, percentage: lowerLimit, isCharging: false });
device.battery.emit('updated', { testid: 6, percentage: upperLimit, isCharging: true });

// c limit: notify always in cycle or not but not when not c
setState({ cycleMonth: new Date().getMonth() });
device.battery.emit('updated', { testid: 7, percentage: 100, isCharging: true });//notify to unplug
device.battery.emit('updated', { testid: 8, percentage: 100, isCharging: false });
setState({ cycleMonth: new Date().getMonth()-1 });
device.battery.emit('updated', { testid: 9, percentage: 100, isCharging: true });//notify to unplug
device.battery.emit('updated', { testid:10, percentage: 100, isCharging: false });

// NOT in cycle: notify at d/c limit and reset cycle only when d/c
setState({ cycleMonth: new Date().getMonth()-1 });
device.battery.emit('updated', { testid:11, percentage: dischargedLimit, isCharging: false });//notify to plug
consolelog('inCycle expected false. is: ' + isWithinCycle(getState()));
setState({ cycleMonth: new Date().getMonth()-1 });
device.battery.emit('updated', { testid:12, percentage: dischargedLimit, isCharging: true });
consolelog('inCycle expected false. is: ' + isWithinCycle(getState()));

// NOT in cycle: notify to unplug if c
setState({ cycleMonth: new Date().getMonth()-1 });
device.battery.emit('startedCharging', { testid:15, percentage: 95, isCharging: true });//discharge fully
device.battery.emit('startedCharging', { testid:16, percentage: 75, isCharging: true });//discharge fully
device.battery.emit('startedCharging', { testid:17, percentage: 35, isCharging: true });//discharge fully
// NOT in cycle: no notify if d/c
setState({ cycleMonth: new Date().getMonth()-1 });
device.battery.emit('startedCharging', { testid:18, percentage: 95, isCharging: false });
device.battery.emit('startedCharging', { testid:19, percentage: 75, isCharging: false });
device.battery.emit('startedCharging', { testid:20, percentage: 35, isCharging: false });

// *Charging events: in cycle: notify if not in 40+ c or 80- d/c range
setState({ cycleMonth: new Date().getMonth() });
device.battery.emit('startedCharging', { testid:21, percentage: 95, isCharging: true });//notify to unplug
device.battery.emit('startedCharging', { testid:22, percentage: 80, isCharging: true });//notify to unplug
device.battery.emit('startedCharging', { testid:23, percentage: 75, isCharging: true });
device.battery.emit('startedCharging', { testid:24, percentage: 40, isCharging: true });
device.battery.emit('startedCharging', { testid:25, percentage: 35, isCharging: true });
device.battery.emit('stoppedCharging', { testid:26, percentage: 95, isCharging: false });
device.battery.emit('stoppedCharging', { testid:27, percentage: 80, isCharging: false });
device.battery.emit('stoppedCharging', { testid:28, percentage: 75, isCharging: false });
device.battery.emit('stoppedCharging', { testid:29, percentage: 40, isCharging: false });//notify to plug
device.battery.emit('stoppedCharging', { testid:30, percentage: 35, isCharging: false });//notify to plug

// in cycle: notify to unplug if prev 80 (shallow = upper)
setState({ cycleMonth: new Date().getMonth(), shallow: 'upper' });
device.battery.emit('updated', { testid:31, percentage: 75, isCharging: true });//notify to unplug
device.battery.emit('updated', { testid:32, percentage: 95, isCharging: true });//notify to unplug
device.battery.emit('updated', { testid:33, percentage: 40, isCharging: true });
consolelog('shallow expected lower. is: ' + getState().shallow);

// in cycle: notify to plug if prev 40 (shallow = lower)
setState({ cycleMonth: new Date().getMonth(), shallow: 'lower' });
device.battery.emit('updated', { testid:34, percentage: 45, isCharging: false });//notify to plug in
device.battery.emit('updated', { testid:35, percentage: 35, isCharging: false });//notify to plug in
device.battery.emit('updated', { testid:36, percentage: 80, isCharging: false });
consolelog('shallow expected upper. is: ' + getState().shallow);

// getShallow tests
getShallow({ testid:37, percentage: 60, isCharging: true });//lower
getShallow({ testid:38, percentage: 60, isCharging: false });//upper
getShallow({ testid:39, percentage: 30, isCharging: true });//lower
getShallow({ testid:40, percentage: 30, isCharging: false });//lower
getShallow({ testid:41, percentage: 90, isCharging: true });//upper
getShallow({ testid:42, percentage: 90, isCharging: false });//upper

// revert to old state
setState(oldstate);
consolelog('reverting. oldstate: ' + stateLog());

consolelog('tests end');

*/
//}/////////////// tests /////////////////
