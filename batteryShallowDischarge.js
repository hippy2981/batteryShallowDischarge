console.log('Starting rule: batteryShallowDischarge');

// battery level limts
var lowerLimit = 40;
var upperLimit = 80;
var criticalLimit = 5;
// notify interval in seconds
var notifyInterval = 30;
// Key(s) used for local storage.
var lastNotifiedKey = 'batteryShallowDischarge.lastNotified';

device.battery.on('updated', function (status) {
    // notify to plug/unplug
    var isOffLimits = (
        ((!status.isCharging && status.percentage <= lowerLimit)
            || (status.isCharging && status.percentage >= upperLimit))
        // notify every 5% only
        && status.percentage % 5 === 0
        // hack: avoid multiple notifications due to multiple 'updated' triggers fired
        && !isNotifiedRecently()
    );
    // notify to unplug
    var isCharged = status.isCharging && status.percentage === 100;
    // notify to plug
    var isDischarged = !status.isCharging && status.percentage <= criticalLimit;
    if (isOffLimits || isCharged || isDischarged) {
        device.notifications
            .createNotification("battery charge: " + status.percentage + "%")
            .show();
        saveLastNotified();
    }
});

// Returns true if notified in last few seconds.
function isNotifiedRecently() {
    var isNotified = false;
    var lastNotified = device.localStorage.getItem(lastNotifiedKey);
    if (lastNotified) {
        var seconds = (new Date().getTime() - lastNotified) / 1000;
        isNotified = seconds <= notifyInterval;
    }
    return isNotified;
}

// Saves current datetime to local storage.
function saveLastNotified() {
    device.localStorage.setItem(lastNotifiedKey, new Date().getTime());
}

// tests
//device.battery.emit('updated', { percentage: lowerLimit });
//device.battery.emit('updated', { percentage: upperLimit });

console.log('Completed rule: batteryShallowDischarge');
