'use strict';

const places = require('./places');
const scoring = require('./scoring');
const diagnose = require('./diagnose');

module.exports = { ...places, ...scoring, ...diagnose };
