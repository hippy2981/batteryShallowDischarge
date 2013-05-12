console.log('Starting rule: batteryShallowDischarge');

device.battery.on('updated', function (status) {
    // note: status.isCharging does not seem to work correctly.
    var isOffLimitsBetter = 
        ((!status.isCharging && status.percentage == 40) ||
			(status.isCharging && status.percentage == 80));
    var isOffLimits = ((status.percentage == 40) || (status.percentage == 80));
    var isCharged = status.percentage == 100;
    var isDischarged = status.percentage <= 5;
	if (isOffLimits || isOffLimitsBetter || isCharged || isDischarged) {
		device.notifications
			.createNotification("battery charge: " + status.percentage + "%")
			.show();
	}
});

// tests
//device.battery.emit('updated', { percentage: 80 });
//device.battery.emit('updated', { percentage: 40 });

console.log('Completed rule: batteryShallowDischarge');

