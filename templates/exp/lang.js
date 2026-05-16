"use strict";

let instructions = [];

switch (version) {
    default:
        var english0 = `
        <p><b>Stroop Task</b></p>
        <p>Experiment: ${experimentName}</p>
        <p>Press <b>Space</b> to continue.</p>`;

        var english1 = `
        <p>Welcome to the Stroop Task!</p>
        <p>Press any key to begin.</p>`;

        var english2 = `
        <p>You will see colour words displayed in different ink colours.</p>
        <p>Press <b>Y</b> if the word matches its ink colour (congruent).</p>
        <p>Press <b>N</b> if the word does not match its ink colour (incongruent).</p>
        <p>Respond as quickly and accurately as possible.</p>
        <p>Press <b>Space</b> to start.</p>`;

        var english3 = (score, earnings) => `
        <p>Thank you! The experiment is complete.</p>
        <p>Your data has been saved.</p>`;
        break;
}

switch (language) {
    default:
        instructions = [english0, english1, english2, english3];
        break;
}

translate(language, ...instructions);
