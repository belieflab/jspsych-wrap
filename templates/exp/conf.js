"use strict";

let debug = true;

const version = "standard";
const experimentName = "Stroop Task";
const experimentAlias = `stroop_${version}`;
const language = "english";
const theme = "light";

const repetitions = {
    production: 3,
    debug: 1,
};

const playwright = false;

let phase = undefined;
const counterbalance = false;
const urlConfig = { default: "" };
const adminEmail = undefined;

const intake = {
    subject: { minLength: 5, maxLength: 5 },
    sites: [],
    phenotypes: ["hc"],
};
