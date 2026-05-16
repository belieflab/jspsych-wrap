"use strict";

let trialIterator = 0;
let score = 0;

const stroopVariables = [
    { colour: "red",   text: "red",   condition: "congruent"   },
    { colour: "red",   text: "green", condition: "incongruent" },
    { colour: "green", text: "green", condition: "congruent"   },
    { colour: "green", text: "red",   condition: "incongruent" },
    { colour: "blue",  text: "blue",  condition: "congruent"   },
    { colour: "blue",  text: "red",   condition: "incongruent" },
];

const trials = stroopVariables.length;
const blocks = 1;
const totalTrials = trials * blocks;
