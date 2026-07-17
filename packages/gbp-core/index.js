'use strict';

const places = require('./places');
const scoring = require('./scoring');
const diagnose = require('./diagnose');
const placeTypeLabels = require('./place-type-labels');

module.exports = { ...places, ...scoring, ...diagnose, ...placeTypeLabels };
