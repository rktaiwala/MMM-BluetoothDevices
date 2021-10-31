'use strict';

const Device = require('../Device');
const UnknownError = require('../errors/UnknownError');

const SECTORS = {
  1: 'sector_1',
  2: 'sector_2',
  3: 'sector_3',
  4: 'sector_4',
  5: 'sector_5',
  6: 'sector_6',
  7: 'sector_7',
  8: 'sector_8',
  15: 'unknown_1',
  31: 'unknown_2',
  23: 'unknown_3',
  47: 'unknown_4',
  55: 'unknown_5',
  254: 'last_sector',
  255: 'no_sector',
};

const STATES = {
  0: 'unknown',
  1: 'initializing',
  2: 'idle',
  3: 'running',
  4: 'charging',
  5: 'setup',
  6: 'flight_menu',
  113: 'final_test',
  114: 'pcb_test',
  115: 'sleeping',
  116: 'transport',
};

const MODES = {
  0: 'off',
  1: 'daily_clean',
  2: 'sensitive',
  3: 'massage',
  4: 'whitening',
  5: 'deep_clean',
  6: 'tongue_cleaning',
  7: 'turbo',
  255: 'unknown',
};

class SmartMatic extends Device {
  /**
   * @param {object} options
   * @param {string} options.name
   * @param {string} options.mac
   * @param {import('../Logger')} logger
   */
  constructor(options, logger) {
    super(options, logger);

    this.BATTERY_TRACK_KEY = 'spray';
    this.BATTERY_UUID = '6e400000-b5a3-f393-e0a9-e50e24dcca93';
    this.BATTERY_SERVICE = '6e400003-b5a3-f393-e0a9-e50e24dcca93';
    this.BATTERY_CHARACTERISTIC = '6e400003-b5a3-f393-e0a9-e50e24dcca93';
    this.BATTERY_PATH = `${this.BATTERY_SERVICE}/${this.BATTERY_CHARACTERISTIC}`;

    if (this.tracks.includes(this.BATTERY_TRACK_KEY)) {
      this.services.push(this.BATTERY_SERVICE);
      this.characteristics.push(this.BATTERY_CHARACTERISTIC);
    }

    this.reconnecting = false;
    this.data = {
      status: null,
      state: null,
      rssi: null,
      pressure: null,
      time: null,
      mode: null,
      sector: null,
      battery: null,
    };
  }

  /**
   * @param {array} props
   * @param {buffer} props.ManufacturerData
   */
  handleAdvertisingForDevice(props) {
    super.handleAdvertisingForDevice(props);
    this.logger.debug(props);
    if (props.ManufacturerData) {
      const data = props.ManufacturerData;

      this.emit('update', this.data);

      if (this.shouldReconnect()) {
        this.reconnecting = true;
        this.logger.info(`reconnecting to: ${this.name}`);

        this.connect(this.iFace, 1)
          .then(() => { this.reconnecting = false; })
          .catch((exception) => {
            this.reconnecting = false;
            this.logger.info(`failed to reconnect to: ${this.name}`);
            this.logger.debug(exception);
          });
      }
    }
  }

  shouldReconnect() {
    return this.tracks.includes(this.BATTERY_TRACK_KEY)
      && this.iFace
      && !this.connected // only if the devices is not connected
      && this.data.time < 5 // only at the beginning of the brush session
      && this.initialized
      && !this.reconnecting;
  }

  /**
   * @param {array} props
   */
  handleNotificationForDevice(props) {
    super.handleNotificationForDevice(props);

    if (props[this.BATTERY_PATH]) {
      this.data.battery = props[this.BATTERY_PATH][0];
      this.logger.debug(`battery updated to: ${this.data.battery}% for: ${this.name}`);

      this.emit('update', this.data);
    }
  }

  watchCharacteristics() {
    super.watchCharacteristics()
      .then(() => new Promise((resolve, reject) => {
        if (!this.tracks.includes(this.BATTERY_TRACK_KEY)) {
          resolve();
        } else if (this.characteristicsByUUID[this.BATTERY_UUID]) {
          const characteristicsInterface = this.characteristicsByUUID[this.BATTERY_UUID];

          // Enable notifications
          characteristicsInterface.Notifying((err, notifying) => {
            if (notifying === false) {
              characteristicsInterface.StartNotify(() => {
                characteristicsInterface.ReadValue({}, (exception, value) => {
                  if (exception) {
                    reject(new UnknownError({
                      troubleshooting: 'devices#characteristics',
                      exception: new Error(exception),
                      extra: {
                        device: this,
                      },
                    }));
                  } else {
                    this.data.battery = value[0];
                    this.emit('update', this.data);
                    resolve();
                  }
                });
              });
            } else {
              resolve();
            }
          });
        } else {
          reject(new UnknownError({
            troubleshooting: 'devices#characteristics',
            exception: new Error('battery characteristics not found'),
            extra: {
              device: this,
            },
          }));
        }
      }));
  }

  destroy() {
    return new Promise((resolve) => {
      if (this.initialized && this.characteristicsByUUID[this.BATTERY_UUID]) {
        const characteristicsInterface = this.characteristicsByUUID[this.BATTERY_UUID];

        characteristicsInterface.Notifying((err, notifying) => {
          if (notifying === true) {
            characteristicsInterface.StopNotify(() => resolve());
          } else {
            resolve();
          }
        });
      }
    }).then(() => super.destroy());
  }
}

module.exports = SmartMatic;
