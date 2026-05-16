"use strict";

let experimentComplete = false;

const jsPsych = initJsPsych({
    show_progress_bar: true,
});

const timeline = [];

const preload = {
    type: jsPsychPreload,
    images: [],
    show_detailed_errors: true,
};

const config = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: instructions[0],
    choices: [" "],
};

const welcome = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: instructions[1],
    on_load: () => handleFullscreen(),
};

const instruction1 = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: instructions[2],
    choices: [" "],
};

const fixation = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: "<p style='font-size:48px'>+</p>",
    trial_duration: 500,
    response_ends_trial: false,
};

const trial = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () =>
        `<p style="color:${jsPsych.timelineVariable("colour", true)}; font-size:48px; font-weight:bold">
            ${jsPsych.timelineVariable("text", true)}
        </p>`,
    choices: ["y", "n"],
    data: {
        colour:    jsPsych.timelineVariable("colour"),
        text:      jsPsych.timelineVariable("text"),
        condition: jsPsych.timelineVariable("condition"),
        subjectId: subjectId,
        interview_date: interview_date,
    },
};

const procedure = {
    timeline: [fixation, trial],
    timeline_variables: stroopVariables,
    randomize_order: true,
    repetitions: getRepetitions(),
};

const dataSave = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: dataSaveAnimation(),
    choices: "NO_KEYS",
    trial_duration: 5000,
    on_finish: async () => { await writeCsvRedirect(); experimentComplete = true; },
};

loadScript("exp/main.js");
