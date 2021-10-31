'use strict';

/* eslint-disable no-console */

// eslint-disable-next-line import/no-unresolved
const NodeHelper = require('node_helper');
const hub = require('./src');

module.exports = NodeHelper.create({
  config: {},
  type:null,
  started: false,
  devices: {},
  dongle: null,

  start() {
    console.log(`Starting node helper for: ${this.name}`);
  },

  startHub(config,type) {
    if (this.started) {
      return;
    }

    this.started = true;

    console.log(`${this.name} starting hub`);

    this.config = config;
    this.type = type;
    this.dongle = hub.initialize(this.name, this.config);

    this.dongle.on('setupCompleted', () => {
      console.log(`${this.name} hub successfully started`);
    });

    this.dongle.on('deviceUpdate', ({ device, data }) => {
      this.devices[device.name] = { device, data };
      if (this.type === 'FETCH_TOOTHBRUSHES') {
        this.sendSocketNotification('FETCH_TOOTHBRUSHES_RESULTS', this.devices);
      }
      if (this.type === 'FETCH_SMARTMATIC') {
        this.sendSocketNotification('FETCH_SMARTMATIC_RESULTS', this.devices);
      }
    });
  },

  async stop() {
    if (!this.started) {
      return;
    }

    console.log(`${this.name} stopping hub`);

    await this.dongle.destroy();

    console.log(`${this.name} hub stopped`);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === 'FETCH_TOOTHBRUSHES') {
      this.startHub(payload,notification);

      this.sendSocketNotification('FETCH_TOOTHBRUSHES_RESULTS', this.devices);
    }
    if (notification === 'FETCH_SMARTMATIC') {
      this.startHub(payload,notification);

      this.sendSocketNotification('FETCH_SMARTMATIC_RESULTS', this.devices);
    }
  },
});
