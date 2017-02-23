const { Launchpad, ColorHelper, DataHelper } = require('./index');

console.log('Running manual interactive Launchpadder2 test');
console.log('After a successfull connection to LaunchPad hardware, press the MIDI buttons and ensure that they are correctly mapped to the button grid');

const hwData = DataHelper.findPortsAndAPI();

if (hwData.midiInPort !== null && hwData.midiOutPort !== null) {
  const Color = ColorHelper(hwData.api);

  const pad = new Launchpad(hwData.midiInPort, hwData.midiOutPort, hwData.api);

  pad.on('press', (button) => {
    if (button.getX() === 8) {
      console.log("Scene button " + button.getY() + " was pressed");
      return;
    }
    button.light();
    console.log(button + " was pressed");
  });

  pad.on('release', (button) => {
    if (button.getX() === 8) {
      console.log("Scene button " + button.getY() + " was released");
      return;
    }
    button.dark();
    console.log(button + " was released");
  });

  console.log('The Launchpadder2 interactive test performs some automated and interactive light feedback testing.');
  console.log('The test is attempting to make the first scene button blink on your LaunchPad hardware');
  let state = Color.GREEN;
  const scene = pad.getButton(8, 0);
  scene.startBlinking(state);

  console.log('Pressing the blinking button will cause it to change the color it blinks');
  scene.on('press', (button) => {
    if (state == Color.GREEN) {
      state = Color.YELLOW;
    } else {
      state = Color.GREEN;
    }
    button.startBlinking(state);
  });

  console.log('The Launchpadder2 interactive test uses the 2nd scene button to perform a toggle test. Press the button to toggle the colors it uses');
  const scene2 = pad.getButton(8, 1);
  scene2.light(Color.AMBER);
  scene2.on('press', (button) => {
    button.toggle(Color.AMBER, Color.RED);
  });

} else {
  console.error('Unable to run the test!');
  process.exit(1);
}
