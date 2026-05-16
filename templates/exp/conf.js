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
    subject: { length: 5 },
    sites: {
        // SiteName: {}                          — no validation
        // SiteName: { prefix: "XXXX", length: 8 } — prefix + length validation
    },
    phenotypes: ["hc"],
};
