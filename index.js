const midi = require('midi');
const { EventEmitter } = require('events');

class Button extends EventEmitter {
  constructor(grid, note, y) {
    super();
    this.grid = grid;
    this.Color = Color(grid.api);
    this.state = this.Color.OFF;
    if (!y) {
      this.x = this.grid.getX(note);
      this.y = this.grid.getY(note);
    } else {
      this.x = note;
      this.y = y;
    }

    this.light = this.light.bind(this);
    this.dark = this.dark.bind(this);
    this.getState = this.getState.bind(this);
    this.getX = this.getX.bind(this);
    this.getY = this.getY.bind(this);
    this.toggle = this.toggle.bind(this);
    this.startBlinking = this.startBlinking.bind(this);
    this.stopBlinking = this.stopBlinking.bind(this);
    this.isBlinking = this.isBlinking.bind(this);
    this.isLit = this.isLit.bind(this);
    this.toNote = this.toNote.bind(this);
    this.toString = this.toString.bind(this);
  }

  light(color = this.Color.AMBER) {
    if (this.y === 8) {
      this.grid.output.sendMessage([176, this.toNote(), color]);
    } else {
      this.grid.output.sendMessage([144, this.toNote(), color]);
    }

    this.state = color;
  }

  dark() {
    if (this.y === 8) {
      this.grid.output.sendMessage([176, this.toNote(), this.Color.OFF]);
    } else {
      this.grid.output.sendMessage([144, this.toNote(), this.Color.OFF]);
    }
    this.state = this.Color.OFF;
  }

  getState() {
    return this.state;
  }

  getX() {
    return this.x;
  }

  getY() {
    return this.y;
  }

  toggle(color = this.Color.AMBER, color2 = this.Color.OFF) {
    let targetColor = color2;
    if (this.state === color2) {
      targetColor = color;
    }
    this.state = targetColor;

    if (this.y === 8) {
      this.grid.output.sendMessage([176, this.toNote(), targetColor]);
    } else {
      this.grid.output.sendMessage([144, this.toNote(), targetColor]);
    }
  }

  startBlinking(color) {
    this.blinkColor = color || this.Color.AMBER;
    this.grid.blinking.push(this);

    if (this.grid.blinking.length === 1) {
      this.grid.blinkInterval = setInterval(this.grid.tick, 500);
    }
  }

  stopBlinking() {
    const index = this.grid.blinking.indexOf(this);
    if (index === -1) return;
    delete this.blinkColor;
    this.grid.blinking.splice(index, 1);
    this.dark();
  }

  isBlinking() {
    if (this.grid.blinking.indexOf(this) === -1) {
      return false;
    }
    return true;
  }

  isLit(color) {
    if (!color) {
      if (this.state === this.Color.OFF) {
        return false;
      }
    } else {
      if (this.state != color) {
        return false;
      }
    }
    return true;
  }

  toNote() {
    if (this.grid.api === 1) {
      if (this.y === 8) {
        return 104 + this.x;
      } else {
        return (this.y * 16) + this.x;
      }
    } else if (this.grid.api === 2) {
      if (this.y === 8) {
        return 104 + this.x;
      } else {
        return 70 - (this.y * 10) + (this.x + 11);
      }
    }
  }

  toString() {
    return `(${this.x}, ${this.y})`
  }

}

class Launchpad extends EventEmitter {
  constructor(midiInput, midiOutput, api) {
    super();
    this.midiInput = midiInput || 0;
    this.midiOutput = midiOutput || 0;
    this.api = api || 1;
    this.grid = [];
    this.blinking = [];
    this.input = new midi.input();
    this.input.openPort(this.midiInput);
    this.output = new midi.output();
    this.output.openPort(this.midiOutput);

    this.initGrid = this.initGrid.bind(this);
    this.getX = this.getX.bind(this);
    this.getY = this.getY.bind(this);
    this.getButton = this.getButton.bind(this);
    this.allDark = this.allDark.bind(this);
    this.tick = this.tick.bind(this);

    this.input.on('message', (deltaTime, msg) => {
      const parsedMessage = msg.toString().split(',');

      let button;
      if (parseInt(msg[0], 10) === 176) {
        button = this.getButton(parseInt(msg[1], 10) % 8, 8);
      } else {
        button = this.getButton(msg[1]);
      }

      const state = (parseInt(msg[2], 10) === 127) ? true : false;

      if (state) {
        this.emit('press', button);
        button.emit('press', button);
      } else {
        this.emit('release', button);
        button.emit('release', button);
      }
    });

    this.initGrid();
  }

  initGrid() {
    for (let x = 0; x < 9; x++) {
      this.grid.push([]);
      for (let y = 0; y < 9; y++) {
        this.grid[x][y] = new Button(this, x, y);
      }
    }
  }

  getX(note) {
    if (this.api === 1) {
      if (note % 8 === 0 && ((note / 8) % 2 === 1)) {
        return 8;
      }
    return note % 8;
    } else if (this.api === 2) {
      return ((note % 10) - 1);
    }
  }

  getY(note) {
    if (this.api === 1) {
      if (note % 8 === 0 && ((note / 8) % 2 === 1)) {
        return Math.floor(note / 8 / 2);
      }
      return Math.floor(note / 8) / 2;
    } else if (this.api === 2) {
      return (8 - ((note - (note % 10)) / 10));
    }
  }

  getButton(x, y) {
    if (y) {
      if (x > 8 || y > 8) {
        return null;
      }
      return this.grid[x][y];
    }
    return this.grid[this.getX(x)][this.getY(x)];
  }

  allDark() {
    this.output.sendMessage([176, 0, 0]);

    for (let x = 0; x < 9; x++) {
      for (let y = 0; y < 9; y++) {
        this.grid[x][y].state = false;
      }
    }
  }

  tick() {
    if (this.blinking.length === 0) {
      clearInterval(this.blinkInterval);
      return;
    }
    this.blinking.forEach((blinking) => {
      if (blinking.getState() === Color(this.api).OFF) {
        blinking.light(blinking.blinkColor);
      } else {
        blinking.dark();
      }
    });
  }


}

const Color1 = {
  OFF: 12,
  LOW_RED: 13,
  RED: 15,
  LOW_AMBER: 29,
  AMBER: 63,
  LOW_GREEN: 28,
  GREEN: 60,
  YELLOW: 62,
  getColor(green, red) {
    green = green || 0;
    red = red || 0;
    return 16 * green + red + 12;
  },
  getGreen(color) {
    if (!color) {
      return false;
    }
    return Math.floor(color / 16);
  },
  getRed(color) {
    if (!color) {
      return false;
    }
    return (color - 12) % 16;
  },
}

const Color2 = {
  OFF: 0,
  LOW_RED: 4,
  RED: 6,
  LOW_AMBER: 8,
  AMBER: 10,
  LOW_GREEN: 13,
  GREEN: 15,
  YELLOW: 62,
}

const Color = (api = 1) => {
  if (api === 1) {
    return Color1;
  } else if (api === 2) {
    return Color2;
  }
};

const Helper = {
  findPortsAndAPI(forceClosePorts) {
    const midiIn = new midi.input();
    const midiOut = new midi.output();
    const midiInCount = midiIn.getPortCount();
    const midiOutCount = midiOut.getPortCount();
    let midiInPort = null;
    let midiOutPort = null;
    let portName = null;
    let api = null;
    if (midiInCount <= 0 || midiOutCount <= 0) {
      console.error('No MIDI devices connected!');
    } else {
      for (let port = 0; port < midiInCount; port++) {
        if (midiIn.getPortName(port).toLowerCase().includes('launchpad')) {
          midiInPort = port;
          break;
        }
      }
      for (let port = 0; port < midiOutCount; port++) {
        if (midiOut.getPortName(port).toLowerCase().includes('launchpad')) {
          midiOutPort = port;
          break;
        }
      }
      if (midiInPort === null || midiOutPort === null) {
        console.error('Launchpadder2 was unable to detect a LaunchPad device. Please check the hardware connection and try again.');
      } else {
        portName = midiIn.getPortName(midiInPort);
        api = 1;
        if (portName.toLowerCase().includes('mk2') || portName.toLowerCase().includes('pro')) {
          api = 2;
        }
        console.log(`${portName} connected. Using API v${api}`);
      }
    }
    if (forceClosePorts) {
      midiIn.closePort();
      midiOut.closePort();
    }
    return { midiInPort, midiOutPort, portName, api };
  }
}

exports.Launchpad = Launchpad;
exports.ColorHelper = Color;
exports.DataHelper = Helper;
