"use strict";

/**
 * Initiates the experiment by entering fullscreen mode and starting the jsPsych timeline.
 * This function should be called when you are ready to start the experiment.
 * It first calls `openFullscreen` to request the browser to enter fullscreen mode,
 * which is typically required for psychological experiments to prevent distractions and ensure consistent presentation.
 * Then, it starts the jsPsych experiment using the `jsPsych.run` method, passing in the predefined `timeline`.
 *
 * Note: Ensure that the `openFullscreen` function is defined and properly requests fullscreen on the document or specific element.
 * Also, make sure that the `timeline` variable is defined and contains the sequence of trials/tasks for the experiment.
 */

function toggleDebugMode(debug) {
    setTimeout(() => {
        if (debug) {
            document.body.classList.remove("hideCursor");
            document.body.classList.add("showCursor");
        } else {
            document.body.classList.remove("showCursor");
            document.body.classList.add("hideCursor");
        }
        // Hide progress bar
        document.getElementById(
            "jspsych-progressbar-container",
        ).style.visibility = "hidden";
    }, 100);
}
/**
 * Sends experiment data to the server to be saved. This function creates an XMLHttpRequest
 * to POST the provided data to 'data.php'. It uses default values for 'name' and 'data'
 * if they are not specified when the function is called.
 *
 * The 'name' defaults to a combination of 'experimentAlias' and 'subjectId', and 'data'
 * defaults to the CSV representation of the jsPsych data object. The server response
 * should be JSON formatted including at least a 'success' field. If the server returns
 * a status code of 200, the response is parsed and passed to the callback along with
 * the success status.
 *
 * @param {string} [name=`${experimentAlias}_${subjectId}`] - The default name associated with the data,
 * which could be used as the filename or identifier on the server. It is constructed from the
 * 'experimentAlias' and 'subjectId' variables, which should be defined prior to calling this function.
 * @param {Object|string} [data=jsPsych.data.get().csv()] - The actual data to be sent to the server,
 * defaulting to the CSV representation of the jsPsych data. This will be stringified to JSON format
 * before sending. Ensure jsPsych is initialized and has data if using the default.
 * @param {Function} callback - A callback function that is called when the request completes.
 * The callback should expect two arguments: a boolean indicating success and the server's response object.
 * The server's response is expected to contain a 'success' attribute indicating the operation's outcome.
 *
 */
/**
 * Sends experiment data to the server to be saved.
 * This function respects the exact filename passed to it.
 */
function saveData(name, data = jsPsych.data.get().csv(), callback = () => {}) {
    // DO NOT MODIFY THE FILENAME HERE - Use exactly what was passed

    const xhr = new XMLHttpRequest();
    xhr.open("POST", (window.__WRAP_BASE__ || "") + "/data");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
            console.log(xhr.responseText); // Log the response text
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    callback(response.success, response);
                } catch (e) {
                    console.error("Parsing error:", e);
                    callback(false, {
                        error: "Parsing error",
                        details: e.message,
                    });
                }
            } else {
                callback(false, { error: xhr.statusText });
            }
        }
    };

    xhr.send(
        JSON.stringify({
            filename: name,
            filedata: data,
        }),
    );
}

function saveDataPromise(data = jsPsych.data.get().csv()) {
    return new Promise((resolve, reject) => {
        const finalName = `${buildBaseFilename()}_${generateTimestamp()}`;
        console.log(`Saving with timestamped filename: ${finalName}`);
        saveData(finalName, data, (isSuccessful, response) => {
            if (isSuccessful) {
                console.log(`Data saved as: ${finalName}.csv`);
                resolve(response);
            } else {
                console.error(`Save failed for: ${finalName}.csv`, response);
                reject(response);
            }
        });
    });
}

/**
 * Generates a timestamp string in the format YYYYMMDDHHmmss
 * @returns {string} Formatted timestamp
 */
function generateTimestamp() {
    return new Date()
        .toISOString()
        .replace(/T/, "")
        .replace(/\..+/, "")
        .replace(/-/g, "")
        .replace(/:/g, "");
}

function buildBaseFilename() {
    if (visit) return `${experimentAlias}_${subjectId}_v${visit}`;
    if (week) return `${experimentAlias}_${subjectId}_w${week}`;
    if (phase !== null && phase >= 0) return `${experimentAlias}_${subjectId}_phase${phase}`;
    return `${experimentAlias}_${subjectId}`;
}

/**
 * Saves experiment data to MongoDB.
 * Collects all data from jsPsych, creates a payload with subject identifiers
 * and experiment data, then sends it to a MongoDB database via API.
 *
 * @async
 * @function
 * @returns {Promise<Object>} The parsed JSON response from the server
 * @throws {Error} If the server response is not OK
 */
async function saveMongo() {
    // Get the full data set as an array of objects from jsPsych
    const data = jsPsych.data.get().values();

    // Find the subjectkey, if available
    const subjectkey = data.find((d) => d.subjectkey)?.subjectkey || null;

    const payload = {
        studyAlias: database, // Database name in MongoDB
        taskAlias: collection, // Collection name in MongoDB
        subjectkey: subjectkey, // NDA GUID (if available)
        src_subject_id: src_subject_id, // Subject ID (if available)
        workerId: workerId, // MTurk worker ID (if available)
        participantId: participantId, // Connect participant ID (if available)
        PROLIFIC_PID: PROLIFIC_PID, // Prolific PID(if available)
        data: data, // Full jsPsych data object
    };

    // Perform the fetch request and await its completion
    const response = await fetch(KLOOJE_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok)
        throw new Error(`Failed to save data: ${response.statusText}`);

    return response.json(); // Parse and return JSON response on success
}

/**
 * Provides a message to be displayed in a confirmation dialog when the user attempts to leave the webpage.
 * This is typically used in conjunction with the browser's beforeunload event to alert the user that changes
 * they made may not be saved if they leave the page. The function returns a string which can be customized
 * to fit the context of the application or website.
 *
 * Note: Modern browsers may not display the returned string to the user but will use it to determine whether
 * or not to show a generic leaving confirmation dialog. Ensure this function is hooked properly to the
 * window's beforeunload event for it to work as expected.
 *
 * Usage example:
 * window.onbeforeunload = areYouSure;
 *
 * @returns {string} A message warning the user about unsaved changes that may be lost if they leave the page.
 * Customize the returned string to match the tone and style of your application.
 */
const areYouSure = () => {
    return "Write something clever here..."; // Customize this message
};

/**
 * Randomly shuffles the elements of an array using the Fisher-Yates (Durstenfeld) shuffle algorithm.
 * This method iterates over a copy of the array from the last element to the first, swapping each element
 * with another random element that comes before it (including itself). This ensures each element has an equal
 * probability of ending up in any position.
 *
 * Note: This function does not modify the original array. Instead, it returns a shuffled copy of the array.
 * The original array remains unchanged.
 *
 * @param {Array} array - The array to be shuffled. This can be an array of any type or a mix of types.
 *
 * @returns {Array} A new array containing the elements of the original array, shuffled randomly.
 *
 * Usage example:
 * const myArray = [1, 2, 3, 4, 5];
 * const shuffledArray = shuffleArray(myArray);
 * console.log(shuffledArray); // Could be [3, 1, 5, 2, 4] or any other permutation
 * console.log(myArray); // Original array remains unchanged: [1, 2, 3, 4, 5]
 */
function shuffleArray(array) {
    // Make a copy to avoid modifying the original array
    const arrayCopy = [...array];

    for (let i = arrayCopy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
    }
    return arrayCopy;
}

/**
 * Displays an animation and a message indicating that data is being saved.
 * This function creates and appends HTML elements to show a loading animation and a warning message
 * to the user not to close the window until the saving process is completed. The elements are styled
 * to indicate the ongoing data-saving process.
 *
 * Usage example:
 * stimulus: dataSaveAnimation();
 */
const dataSaveAnimation = () => {
    return `
<div class='data-save-animation'>
    <p>Data saving...</p>
    <div class="sk-cube-grid">
        <div class="sk-cube sk-cube1"></div>
        <div class="sk-cube sk-cube2"></div>
        <div class="sk-cube sk-cube3"></div>
        <div class="sk-cube sk-cube4"></div>
        <div class="sk-cube sk-cube5"></div>
        <div class="sk-cube sk-cube6"></div>
        <div class="sk-cube sk-cube7"></div>
        <div class="sk-cube sk-cube8"></div>
        <div class="sk-cube sk-cube9"></div>
    </div>
    <p>Do not close this window until the text disappears.</p>
</div>`;
};

/**
 * Translates the text of consent-related buttons based on the selected language.
 * Defaults to English if the selected language is unsupported.
 *
 * @param {string} language - The selected language for translation. Supported languages
 *                            include English, French, and German. Defaults to English
 *                            for any other inputs or unsupported languages.
 * @param {array} instructions - An array of instructions specified to be translated.
 */

// Function to translate instructions based on selected language
function translate(language, ...instructions) {
    // Load the consent language file based on the selected language
    // Check if the 'consentForm' element exists
    const consentForm = document.getElementById("consentForm");
    if (consentForm) {
        // If the element exists, proceed with fetching and updating content
        document.addEventListener("DOMContentLoaded", () => {
            const langFilePath = `wrap/include/lang/${language}.php`;

            fetch(langFilePath)
                .then((response) =>
                    response.ok
                        ? response.text()
                        : Promise.reject("Failed to load"),
                )
                .then((result) => {
                    if (!result || result.trim().length === 0)
                        throw new Error("Empty response");
                    document.getElementById("consentForm").innerHTML = result;
                    document.getElementById("consentButton").style.display =
                        "block";
                    // Show consent form and submit button
                    document.querySelector(".loading").style.display = "none";
                    document.querySelector(".consent").style.display = "block";
                    document.querySelector(".buttonHolder").style.display = "block";
                })
                .catch((error) => {
                    console.error("Error loading language file: ", error);
                    document.getElementById("consentButton").style.display =
                        "none"; // Ensure button is shown with fallback content
                });
        });

        let consent, submit; // Variables for the translated texts of the consent buttons

        // Determine the translation based on the selected language
        switch (language) {
            case "french":
                consent = "CONSENTEMENT";
                submit = "SOUMETTRE";
                break;

            case "german":
                consent = "ZUSTIMMUNG";
                submit = "EINREICHEN";
                break;

            default: // Default case for English and unsupported languages
                consent = "CONSENT";
                submit = "SUBMIT";
                break;
        }

        // Update the webpage elements with the translated text
        const consentButton = document.getElementById("consentButton"); // Update consent button
        const submitButton = document.getElementById("submitButton"); // Replace 'yourElementId' with the actual ID
        if (consentButton) {
            consentButton.innerHTML = consent; // Modify as needed
        }
        if (submitButton) {
            submitButton.innerHTML = submit; // Modify as needed
        }
    }

    let translatedInstructions = []; // Array to store translated instructions

    // Determine the translation based on the selected language
    switch (language) {
        case "french":
            translatedInstructions = instructions;
            break;

        case "german":
            translatedInstructions = instructions;
            break;

        default: // Default case for English and unsupported languages
            translatedInstructions = instructions; // No translation needed, keep original instructions
            break;
    }

    // Iterate through translated instructions and update corresponding webpage elements.
    translatedInstructions.forEach((translatedInstruction, index) => {
        // Construct the element ID. The first instruction element is named 'welcome_stim',
        // subsequent elements follow the pattern 'instructionX_stim' where X is the index.
        let instructionElementId =
            index === 0 ? "welcome_stim" : `instruction${index + 1}_stim`;

        // Check if an element with the constructed ID exists. If it does, update its content
        // with the translated instruction.
        if (document.getElementById(instructionElementId)) {
            document.getElementById(instructionElementId).innerHTML =
                translatedInstruction;
        }
    });
}

/**
 * Removes specified keys from a given data object. This function is designed for cleaning up the data object
 * in jsPsych experiments by removing unnecessary or unwanted information before it is stored or analyzed.
 *
 * @param {Object} data - The data object generated by a jsPsych trial. This object contains various
 *                        properties that are recorded during the trial, such as responses and timing information.
 * @param {...string} keysToRemove - The keys to remove from the data object. If no keys are provided,
 *                                   'response' and 'question_order' are removed by default.
 * @returns {Object} The cleaned data object with the specified keys removed.
 */
function removeOutputVariables(data, ...keysToRemove) {
    keysToRemove.forEach((key) => {
        delete data[key];
    });
    return data;
}

// handle trial repetition dynamically

// Current repetitions based on debug state
let currentRepetitions = { ...repetitions.production };

/**
 * Initializes currentRepetitions based on the debug state.
 * If debug is true, repetitions are set to minimal values (debug configuration),
 * otherwise, they are set to standard values (production configuration).
 */

function initializeRepetitions() {
    // Check if the configuration uses objects or single numbers
    if (typeof repetitions.production === "number") {
        // Configuration uses single number, apply directly
        currentRepetitions = debug ? repetitions.debug : repetitions.production;
    }

    if (
        typeof repetitions.production === "object" &&
        repetitions.production !== null
    ) {
        // Configuration uses objects, spread into currentRepetitions
        currentRepetitions = debug
            ? { ...repetitions.debug }
            : { ...repetitions.production };
    }
}

/**
 * Handles the potential switch from debug to production mode.
 * This function checks if an hour has passed since the last prompt, using timestamps stored in local storage.
 * If the conditions are met (one hour passed and no alert shown), it prompts the user to switch to production mode.
 * If the user agrees to switch, it updates the debug state to false, applies full screen mode, and reinitializes repetitions.
 * Local storage is updated to reflect the new state and time of the prompt.
 */
function handleDebugSwitch() {
    const currentTime = Date.now();
    const lastPromptTime = parseInt(localStorage.getItem("lastPromptTime")) || 0;
    const alertShown = localStorage.getItem("alertShown") === "true";
    // 36ms threshold: effectively fires once per page load, gated by the alertShown localStorage flag
    const minIntervalMs = 36;

    if (currentTime - lastPromptTime > minIntervalMs && !alertShown) {
        localStorage.setItem("lastPromptTime", currentTime.toString());
        localStorage.setItem("alertShown", "true");
        alert(
            "WARNING: This task is currently in debug mode, meaning all trials will not be administered and the data will be unusable! If you want to switch to production mode, change the debug configuration.",
        );
        initializeRepetitions();
    }
}

/**
 * Retrieves the current repetitions, handling the debug mode if active.
 * If the program is in debug mode, it will check and possibly handle a switch to production mode via handleDebugSwitch().
 * Returns the current configuration of repetitions, which could be affected by the debug switch handling.
 *
 * @returns {Object} An object with the current configuration for learning, blocking, and testing repetitions.
 */
function getRepetitions() {
    if (debug) {
        handleDebugSwitch();
    }

    return currentRepetitions;
}

// Perform initial setup of repetitions based on the initial debug state
initializeRepetitions();

/**
 * Initializes fullscreen mode for the experiment when not in debug mode.
 * Wrapper function that calls openFullscreen() if debug mode is disabled.
 */
const handleFullscreen = () => {
    if (!debug && !playwright) openFullscreen();
};

/**
 * Adjusts timeline variables based on the current mode (debug or production) and manages the transition between these modes.
 * This function checks if the system is in debug mode and, if so, whether it should switch to production mode.
 * The switch prompt is shown only once per session or after one hour has passed since the last prompt, to prevent frequent interruptions.
 *
 * @param {Array} timelineVariables - The array of timeline variables that may be modified based on the current mode.
 * @returns {Array} The modified array of timeline variables, adjusted based on whether the system is in debug or production mode.
 */
function shuffleTimelineVariables(timelineVariables) {
    if (debug) {
        handleDebugSwitch();
    }
    return debug
        ? shuffleArray(timelineVariables).slice(0, 1)
        : shuffleArray(timelineVariables);
}

// add on for shuffleTimelineVariables and getRepetitions
// Add event listener for the window load event.
document.addEventListener("DOMContentLoaded", (event) => {
    // Check if the alertShown flag is set in local storage.
    if (localStorage.getItem("alertShown") === "true") {
        // remove the alertShown flag from local storage.
        localStorage.removeItem("alertShown");
    }
});

/**
 * @fileoverview Configuration settings for the user interface theme of the application.
 * This file includes constants and settings that define the look and feel of the application's UI.
 */

/**
 * Represents the UI theme setting for the application.
 * This constant determines the overall color scheme and style applied to the application interface.
 * It should be set to either 'light' or 'dark' according to the preferred default appearance.
 *
 * @constant {string} theme - The theme setting for the UI. Possible values: 'light', 'dark'.
 */
switch (theme) {
    case "dark":
        document.documentElement.classList.add("dark-theme"); // Adds the dark theme
        break;
    case "light":
        document.documentElement.classList.add("light-theme"); // Adds the white theme
        break;
    case "white":
        document.documentElement.classList.add("white-theme"); // Adds the white theme
        break;
    case "gray":
        document.documentElement.classList.add("gray-theme"); // Adds the white theme
        break;
    default:
        document.documentElement.classList.add("light-theme"); // Adds the white theme
        break;
}

const screenResolutionHeight = screen.height;

/**
 * Requests fullscreen mode for the document element.
 * Attempts to enter fullscreen mode using various browser-specific methods,
 * with error handling for unsupported scenarios.
 *
 * @function
 * @side-effects {DOM} Changes display mode to fullscreen if supported
 */
const openFullscreen = () => {
    if (playwright) {
        return;
    }
    const element = document.documentElement;

    try {
        // Helper function to request fullscreen with browser compatibility
        function requestFullscreenForElement(elem) {
            let requestResult;
            if (elem.requestFullscreen) {
                requestResult = elem.requestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                // Firefox
                elem.mozRequestFullScreen();
            } else if (elem.webkitRequestFullscreen) {
                // Chrome, Safari and Opera
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                // IE/Edge
                elem.msRequestFullscreen();
            }
            if (requestResult && typeof requestResult.catch === "function") {
                requestResult.catch((error) => {
                    console.warn("Fullscreen request blocked:", error);
                });
            }
        }

        requestFullscreenForElement(element);
    } catch (error) {
        console.error("Error attempting to enable full-screen:", error);
    }
};

const closeFullscreen = () => {
    try {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    } catch (error) {
        console.error("Failed to exit full screen:", error);
    }
};

/**
 * Shuffles the keys of an object randomly.
 * Creates a new object with the same values but with randomly reordered keys.
 *
 * @param {Object} obj - The object whose keys should be shuffled
 * @returns {Object} A new object with the same values but randomly reordered keys
 */
function shuffleKeys(obj) {
    // get keys of input object; Object.keys() method returns an array containing keys of the object
    let shuffledKeys = Object.keys(obj).sort(() => Math.random() - 0.5);
    let shuffledObj = {};
    shuffledKeys.forEach(function (key) {
        shuffledObj[key] = obj[key];
    });
    return shuffledObj;
}

/**
 * Calculates the percentage of trials completed in the experiment.
 * Uses global variables trialIterator and totalTrials to compute progress.
 *
 * @returns {number} The percentage of trials completed, rounded to the nearest integer
 */
const calculatePercentComplete = () => {
    return Math.round((trialIterator / totalTrials) * 100);
};

/**
 * Updates the width of a progress bar to reflect the confidence level in a trial.
 * Increments the bar's width up to a maximum of 100%.
 *
 * @returns {number} The updated confidence level as a percentage of the progress bar's width.
 */
function moveConfidenceBasic() {
    let progressBar = document.getElementById("keyBar");
    let currentWidth = parseFloat(progressBar.style.width); // Get current width percentage

    if (currentWidth >= 100) {
        progressBar.style.width = "100%";
        totalConfidence = 100;
    } else {
        const increment = 3.7;
        currentWidth = Math.min(currentWidth + increment, 100);
        progressBar.style.width = `${currentWidth}%`;
        totalConfidence = currentWidth;
    }
    return totalConfidence;
}

/**
 * Updates the width of a progress bar to reflect the confidence level in a trial.
 * Increments the bar's width up to a maximum of 100%. Once the progress bar reaches 100%,
 * it resets the bar to 0%, marks the trial as complete, and ends the trial.
 *
 * @returns {number} The updated confidence level as a percentage of the progress bar's width.
 */
function moveConfidence() {
    let progressBar = document.getElementById("keyBar");
    let currentWidth = parseFloat(progressBar.style.width); // Get current width percentage

    if (currentWidth >= 100) {
        progressBar.style.width = "0%";
        totalConfidence = 100;
        jsPsych.finishTrial();
    } else {
        const increment = 3.7;
        currentWidth = Math.min(currentWidth + increment, 100);
        progressBar.style.width = `${currentWidth}%`;
        totalConfidence = currentWidth;
    }
    return totalConfidence;
}

function moveConfidenceWithBeep() {
    let progressBar = document.getElementById("keyBar");
    let currentWidth = parseFloat(progressBar.style.width);
    let beep = document.getElementById("beep");

    if (currentWidth >= 100) {
        progressBar.style.width = "0%";
        totalConfidence = 100;
        beep.play(); // Play beep at 100%
        jsPsych.finishTrial();
    } else {
        const increment = 3.7;
        let newWidth = Math.min(currentWidth + increment, 100);
        progressBar.style.width = `${newWidth}%`;
        totalConfidence = newWidth;

        // Check for beep points
        if (currentWidth < 1 && newWidth >= 1) {
            beep.src = "stim/audio_tones/confidence.mp3";
            beep.play();
        } else if (currentWidth < 25 && newWidth >= 25) {
            beep.src = "stim/audio_tones/confidence_25.mp3";
            beep.play();
        } else if (currentWidth < 50 && newWidth >= 50) {
            beep.src = "stim/audio_tones/confidence_50.mp3";
            beep.play();
        } else if (currentWidth < 75 && newWidth >= 75) {
            beep.src = "stim/audio_tones/confidence_75.mp3";
            beep.play();
        } else if (currentWidth < 99 && newWidth >= 99) {
            beep.src = "stim/audio_tones/confidence_100.mp3";
            beep.play();
        }
    }

    return totalConfidence;
}

/**
 * Handles key press events to dynamically update the confidence bar based on user input.
 * This function sets up event listeners on a specified text box to detect and manage keydown and keyup events,
 * adjusting the confidence level accordingly. The function assumes the presence of a progress bar (`barFill`)
 * and a text input (`tapTapElement`) in the DOM.
 *
 * When keys '0' (key code 48) or '1' (key code 49) are pressed, it either increases or maintains a level of
 * 'totalConfidence' and updates the display through `moveConfidenceBasic()`. The function ensures the UI elements
 * are properly focused and handles the key events to prevent default behaviors and stop event propagation.
 */
function buttonPressBasic() {
    const barFill = document.getElementById("fillUp");
    if (barFill) {
        barFill.innerHTML = responseOptions; // Assuming 'responseOptions' is defined
    }
    const tapTapElement = document.getElementById("tapTap");
    if (tapTapElement) {
        tapTapElement.focus(); // Focus on the text box to capture key events
        let keyHeld48 = false;
        let keyHeld49 = false;

        const handleKeyPress = (keycode, isKeyDown) => {
            if (keycode === 48) {
                keyHeld48 = isKeyDown;
            } else if (keycode === 49) {
                keyHeld49 = isKeyDown;
            }
            responseKey = keycode;

            if (keyHeld48 || keyHeld49) {
                totalConfidence = moveConfidenceBasic();
            }
        };

        tapTapElement.addEventListener("keydown", function (event) {
            const keycode = event.which;
            if (keycode === 48 || keycode === 49) {
                handleKeyPress(keycode, true);
                event.preventDefault(); // Prevent default action and stop propagation
            }
        });

        tapTapElement.addEventListener("keyup", function (event) {
            const keycode = event.which;
            if (keycode === 48 || keycode === 49) {
                handleKeyPress(keycode, false);
                event.preventDefault(); // Prevent default action and stop propagation
            }
        });
    }
}

/**
 * Handles key press events to dynamically update the confidence bar based on user input.
 * This function sets up event listeners on a specified text box to detect and manage keydown and keyup events,
 * adjusting the confidence level accordingly. The function assumes the presence of a progress bar (`barFill`)
 * and a text input (`tapTapElement`) in the DOM.
 *
 * Parameters:
 *   key1 - The key code for the first key to monitor (48 for '0').
 *   key2 - The key code for the second key to monitor (49 for '1').
 *
 * This function ensures the UI elements are properly focused and handles the key events to prevent
 * default behaviors and stop event propagation.
 */
function buttonPress(key1, key2) {
    console.log("Trial loaded with keys:", key1, key2); // Debug: Check if the trial is loading

    const barFill = document.getElementById("fillUp");
    if (barFill) {
        barFill.innerHTML = responseOptions; // Assuming 'responseOptions' is defined
        console.log("Bar fill set"); // Debug: Check if bar fill is set
    } else {
        console.log("Bar fill element not found"); // Debug: Check if element exists
    }

    const tapTapElement = document.getElementById("tapTap");
    if (tapTapElement) {
        tapTapElement.focus(); // Focus on the text box to capture key events
        console.log("Focus set on tapTap element"); // Debug: Check if focus is set

        let keyHeld1 = false;
        let keyHeld2 = false;

        const handleKeyPress = (keycode, isKeyDown) => {
            console.log(`Key ${keycode} ${isKeyDown ? "pressed" : "released"}`); // Debug: Log key press/release

            if (keycode === key1) {
                keyHeld1 = isKeyDown;
                console.log(`${String.fromCharCode(key1)} key held:`, keyHeld1); // Debug: Check key1 state
            } else if (keycode === key2) {
                keyHeld2 = isKeyDown;
                console.log(`${String.fromCharCode(key2)} key held:`, keyHeld2); // Debug: Check key2 state
            }
            responseKey = keycode;
            console.log("Response key:", responseKey); // Debug: Log response key

            if (keyHeld1 || keyHeld2) {
                totalConfidence = moveConfidence();
                console.log("Total confidence:", totalConfidence); // Debug: Log confidence
            }
        };

        tapTapElement.addEventListener("keydown", function (event) {
            const keycode = event.which;
            console.log("Keydown event:", keycode); // Debug: Log keydown event
            if (keycode === key1 || keycode === key2) {
                handleKeyPress(keycode, true);
                event.preventDefault(); // Prevent default action and stop propagation
            }
        });

        tapTapElement.addEventListener("keyup", function (event) {
            const keycode = event.which;
            console.log("Keyup event:", keycode); // Debug: Log keyup event
            if (keycode === key1 || keycode === key2) {
                handleKeyPress(keycode, false);
                event.preventDefault(); // Prevent default action and stop propagation
            }
        });
    } else {
        console.log("tapTap element not found"); // Debug: Check if element exists
    }
}

/**
 * Handles key press events to dynamically update the confidence bar based on user input.
 * This function sets up event listeners on a specified text box to detect and manage keydown and keyup events,
 * adjusting the confidence level accordingly. The function assumes the presence of a progress bar (`barFill`)
 * and a text input (`tapTapElement`) in the DOM.
 *
 * Parameters:
 *   key1 - The key code for the first key to monitor.
 *   key2 - The key code for the second key to monitor.
 *
 * This function ensures the UI elements are properly focused and handles the key events to prevent
 * default behaviors and stop event propagation.
 */
function buttonPressWithArguments(key1, key2, beep) {
    console.log("Trial loaded"); // Debug: Check if the trial is loading

    const barFill = document.getElementById("fillUp");
    if (barFill) {
        barFill.innerHTML = responseOptions; // Assuming 'responseOptions' is defined
        console.log("Bar fill set"); // Debug: Check if bar fill is set
    } else {
        console.log("Bar fill element not found"); // Debug: Check if element exists
    }

    const tapTapElement = document.getElementById("tapTap");
    if (tapTapElement) {
        tapTapElement.focus(); // Focus on the text box to capture key events
        console.log("Focus set on tapTap element"); // Debug: Check if focus is set

        let keyHeld1 = false;
        let keyHeld2 = false;

        const handleKeyPress = (keycode, isKeyDown) => {
            console.log(`Key ${keycode} ${isKeyDown ? "pressed" : "released"}`); // Debug: Log key press/release

            if (keycode === key1) {
                keyHeld1 = isKeyDown;
                console.log(`${String.fromCharCode(key1)} key held:`, keyHeld1); // Debug: Check key1 state
            } else if (keycode === key2) {
                keyHeld2 = isKeyDown;
                console.log(`${String.fromCharCode(key2)} key held:`, keyHeld2); // Debug: Check key2 state
            }
            responseKey = keycode;
            console.log("Response key:", responseKey); // Debug: Log response key

            if (keyHeld1 || keyHeld2) {
                if (beep) {
                    totalConfidence = moveConfidenceWithBeep();
                }
                if (!beep) {
                    totalConfidence = moveConfidence();
                }
                console.log("Total confidence:", totalConfidence); // Debug: Log confidence
            }
        };

        tapTapElement.addEventListener("keydown", function (event) {
            const keycode = event.which;
            console.log("Keydown event:", keycode); // Debug: Log keydown event
            if (keycode === key1 || keycode === key2) {
                handleKeyPress(keycode, true);
                event.preventDefault(); // Prevent default action and stop propagation
            }
        });

        tapTapElement.addEventListener("keyup", function (event) {
            const keycode = event.which;
            console.log("Keyup event:", keycode); // Debug: Log keyup event
            if (keycode === key1 || keycode === key2) {
                handleKeyPress(keycode, false);
                event.preventDefault(); // Prevent default action and stop propagation
            }
        });
    } else {
        console.log("tapTap element not found"); // Debug: Check if element exists
    }
}

/**
 * Determines whether a progress message should be displayed based on completion percentage.
 * Shows messages at 25%, 50%, and 75% completion points.
 *
 * @returns {boolean} True if the current completion percentage is 25%, 50%, or 75%, false otherwise
 */
const shouldShowProgressMessage = () => {
    // Show the message after every 25% completion
    let percentComplete = calculatePercentComplete();
    // console.log("Percent Complete: ", percentComplete);
    return [25, 50, 75].includes(percentComplete); // Show the message at 25%, 50%, and 75%
};

/**
 * Populates a select element with options and autopopulates if there's only one option
 * @param {HTMLSelectElement} selectElement - The select element to populate
 * @param {string[]} options - Array of option values
 */
function populateAndAutofillSelect(selectElement, options) {
    selectElement.innerHTML = '<option value="">---</option>';
    options.forEach((option) => {
        const optionElement = new Option(option, option);
        selectElement.add(optionElement);
    });

    if (options.length === 1) {
        selectElement.value = options[0];
        selectElement.disabled = true;
    }
}

/**
 * Safer event listener for DOM elements in the intake form.
 * Fixes the error: "Cannot read properties of null (reading 'insertAdjacentHTML')"
 * by checking if elements exist before manipulating them.
 */
// Safer event listener for include/intake.php
document.addEventListener("DOMContentLoaded", (event) => {
    // First check if we're in intake mode (empty query string)
    if (!location.search) {
        console.log("FORM SETUP: Intake mode detected - setting up form");

        // First check if the intake form exists before trying to manipulate it
        const intakeForm = document.getElementById("intake");
        if (!intakeForm) {
            console.log(
                "FORM SETUP: Intake form not found - skipping form setup",
            );
            return; // Exit early if the form doesn't exist
        }

        // Continue with form setup if the form exists
        console.log("FORM SETUP: Intake form found - proceeding with setup");

        // Safely check if intake object exists
        if (typeof intake === "undefined") {
            console.error(
                "FORM SETUP ERROR: intake object is not defined. Define it in conf.js",
            );
            return;
        }

        // Add event listener for submit button (with delay to ensure DOM is ready)
        setTimeout(() => {
            const submitButton = document.getElementById("submitButton");
            if (
                submitButton &&
                !submitButton.hasAttribute("data-listener-added")
            ) {
                // Intake button may already call validateIntake via inline onclick.
                // Avoid attaching a second handler that would trigger duplicate script loads.
                if (submitButton.getAttribute("onclick")) {
                    submitButton.setAttribute("data-listener-added", "true");
                    return;
                }
                console.log("FORM SETUP: Adding submit button event listener");
                submitButton.addEventListener("click", function () {
                    // Call validation directly if function doesn't exist
                    if (typeof validateIntake === "function") {
                        validateIntake();
                    } else {
                        console.log(
                            "validateIntake not found, calling validation directly",
                        );
                        // Call validation inline
                        performIntakeValidation();
                    }
                });
                // Mark that listener has been added to prevent duplicates
                submitButton.setAttribute("data-listener-added", "true");
            }
        }, 200); // Increased delay

        // Show/hide GUID field based on NIH configuration
        if (intake.nih === true) {
            console.log("FORM SETUP: NIH study detected - showing GUID field");
            const guidContainer = document.getElementById("guid-container");
            const guidInput = document.getElementById("guid");
            if (guidContainer && guidInput) {
                guidContainer.style.display = "block";
                guidInput.setAttribute("required", "required");
            }
        } else {
            console.log(
                "FORM SETUP: Non-NIH study - GUID field remains hidden",
            );
        }

        // Populate site select if it exists
        const siteSelectElement = document.getElementById("site");
        if (siteSelectElement && intake.sites) {
            console.log("FORM SETUP: Populating site select element");
            populateAndAutofillSelect(siteSelectElement, Object.keys(intake.sites));
        }

        // Populate phenotype select if it exists
        const phenotypeSelectElement = document.getElementById("phenotype");
        if (phenotypeSelectElement && intake.phenotypes) {
            console.log("FORM SETUP: Populating phenotype select element");
            populateAndAutofillSelect(
                phenotypeSelectElement,
                intake.phenotypes,
            );
        }

        // Populate visit select if it exists
        const visitSelectElement = document.getElementById("visit");
        if (visitSelectElement && intake.visits) {
            console.log("FORM SETUP: Populating visit select element");
            populateAndAutofillSelect(visitSelectElement, intake.visits);
        }

        // Populate week select if it exists
        const weekSelectElement = document.getElementById("week");
        if (weekSelectElement && intake.weeks) {
            console.log("FORM SETUP: Populating week select element");
            populateAndAutofillSelect(weekSelectElement, intake.weeks);
        }

        // Configure subject field if it exists
        const subjectElement = document.getElementById("subject");
        if (subjectElement && intake.subject) {
            console.log("FORM SETUP: Configuring subject input field");
            subjectElement.setAttribute("minlength", intake.subject.minLength);
            subjectElement.setAttribute("maxlength", intake.subject.maxLength);

            // Set the prefix as the initial value
            if (intake.subject.prefix) {
                subjectElement.value = intake.subject.prefix;

                // Add visual styling to indicate prefix
                subjectElement.classList.add("has-prefix");
                const prefixWidth = intake.subject.prefix.length * 0.6 + "em"; // Approximate character width
                subjectElement.style.setProperty("--prefix-width", prefixWidth);

                // Add event listener to prevent deletion of prefix
                subjectElement.addEventListener("input", function () {
                    // Always ensure the value starts with the prefix
                    if (!this.value.startsWith(intake.subject.prefix)) {
                        this.value = intake.subject.prefix;
                    }
                    // Convert to uppercase
                    this.value = this.value.toUpperCase();

                    // Set cursor position after the prefix
                    const prefixLength = intake.subject.prefix.length;
                    if (this.selectionStart < prefixLength) {
                        setTimeout(() => {
                            this.setSelectionRange(prefixLength, prefixLength);
                        }, 0);
                    }
                });

                // Prevent backspace/delete from removing prefix
                subjectElement.addEventListener("keydown", function (event) {
                    const prefixLength = intake.subject.prefix.length;
                    const cursorPosition = this.selectionStart;

                    // Prevent deletion if it would affect the prefix
                    if (
                        (event.key === "Backspace" || event.key === "Delete") &&
                        cursorPosition <= prefixLength
                    ) {
                        event.preventDefault();
                        // Move cursor to after prefix
                        setTimeout(() => {
                            this.setSelectionRange(prefixLength, prefixLength);
                        }, 0);
                    }
                });

                // Set initial cursor position after prefix
                subjectElement.addEventListener("focus", function () {
                    const prefixLength = intake.subject.prefix.length;
                    setTimeout(() => {
                        this.setSelectionRange(prefixLength, prefixLength);
                    }, 0);
                });

                // Handle paste events
                subjectElement.addEventListener("paste", function (event) {
                    event.preventDefault();
                    const pastedText = (
                        event.clipboardData || window.clipboardData
                    ).getData("text");
                    const prefixLength = intake.subject.prefix.length;
                    const currentPosition = this.selectionStart;

                    // Only allow pasting after the prefix
                    if (currentPosition >= prefixLength) {
                        const beforeCursor = this.value.substring(
                            0,
                            currentPosition,
                        );
                        const afterCursor = this.value.substring(
                            this.selectionEnd,
                        );
                        const newValue =
                            beforeCursor + pastedText + afterCursor;

                        // Ensure the result still starts with prefix and doesn't exceed max length
                        if (
                            newValue.startsWith(intake.subject.prefix) &&
                            newValue.length <= intake.subject.maxLength
                        ) {
                            this.value = newValue.toUpperCase();
                        }
                    }
                });
            } else {
                // No prefix, just convert to uppercase
                subjectElement.addEventListener("input", function () {
                    this.value = this.value.toUpperCase();
                });
            }
        }

        // Add visit field if it doesn't exist and is needed
        if (
            intake.visits &&
            intake.visits.length > 0 &&
            !document.getElementById("visit")
        ) {
            console.log("FORM SETUP: Adding visit field (doesn't exist yet)");
            try {
                const visitHtml = `
                    <h4 style="color:black"><label for="visit">Visit:</label></h4>
                    <select name="visit" id="visit" class="custom-select">
                        <option value="">---</option>
                        ${intake.visits
                            .map(
                                (visit) =>
                                    `<option value="${visit}">${visit}</option>`,
                            )
                            .join("")}
                    </select>
                `;
                intakeForm.insertAdjacentHTML("beforeend", visitHtml);

                // Make sure the select element was created before trying to populate it
                const newVisitSelect = document.getElementById("visit");
                if (newVisitSelect) {
                    populateAndAutofillSelect(newVisitSelect, intake.visits);
                }
            } catch (error) {
                console.error(
                    "FORM SETUP ERROR: Failed to add visit field",
                    error,
                );
            }
        }

        // Add week field if it doesn't exist and is needed
        if (
            intake.weeks &&
            intake.weeks.length > 0 &&
            !document.getElementById("week")
        ) {
            console.log("FORM SETUP: Adding week field (doesn't exist yet)");
            try {
                const weekHtml = `
                    <h4 style="color:black"><label for="week">Week:</label></h4>
                    <select name="week" id="week" class="custom-select">
                        <option value="">---</option>
                        ${intake.weeks
                            .map(
                                (week) =>
                                    `<option value="${week}">${week}</option>`,
                            )
                            .join("")}
                    </select>
                `;
                intakeForm.insertAdjacentHTML("beforeend", weekHtml);

                // Make sure the select element was created before trying to populate it
                const newWeekSelect = document.getElementById("week");
                if (newWeekSelect) {
                    populateAndAutofillSelect(newWeekSelect, intake.weeks);
                }
            } catch (error) {
                console.error(
                    "FORM SETUP ERROR: Failed to add week field",
                    error,
                );
            }
        }

        console.log("FORM SETUP: Completed successfully");
    }

    // Check for alertShown in localStorage (common to all modes)
    if (localStorage.getItem("alertShown") === "true") {
        localStorage.removeItem("alertShown");
    }
});

/**
 * Helper function to safely add or remove elements from DOM.
 * Can be used when you need to manipulate DOM content to prevent errors.
 *
 * @param {string} id - ID of the element to manipulate
 * @param {string} content - HTML content to insert
 * @param {string} [location="innerHTML"] - Where to insert content (innerHTML, beforeend, etc.)
 * @returns {boolean} - Whether the operation was successful
 */
function safelyUpdateDOM(id, content, location = "innerHTML") {
    try {
        const element = document.getElementById(id);
        if (!element) {
            console.error(
                `DOM UPDATE ERROR: Element with id '${id}' not found`,
            );
            return false;
        }

        switch (location) {
            case "innerHTML":
                element.innerHTML = content;
                break;
            case "beforeend":
                element.insertAdjacentHTML("beforeend", content);
                break;
            case "afterbegin":
                element.insertAdjacentHTML("afterbegin", content);
                break;
            case "beforebegin":
                element.insertAdjacentHTML("beforebegin", content);
                break;
            case "afterend":
                element.insertAdjacentHTML("afterend", content);
                break;
            default:
                element.innerHTML = content;
        }

        return true;
    } catch (error) {
        console.error(
            `DOM UPDATE ERROR: Failed to update element with id '${id}'`,
            error,
        );
        return false;
    }
}

/**
 * Utility function to handle experiment data display after completion
 * Safely updates the DOM with appropriate messages
 */
function safelyDisplayCompletionMessage(message) {
    try {
        const contentElement = document.querySelector("#jspsych-content");
        if (contentElement) {
            contentElement.innerHTML = message;
            return true;
        } else {
            // Fallback if jspsych-content doesn't exist
            document.body.innerHTML = `
                <div style="max-width: 800px; margin: 50px auto; text-align: center; font-family: sans-serif;">
                    ${message}
                </div>
            `;
            return true;
        }
    } catch (error) {
        console.error("Failed to display completion message", error);
        // Last resort fallback
        alert("Experiment complete! " + message.replace(/<[^>]*>/g, " "));
        return false;
    }
}

/**
 * Tests data saving functionality by saving to a .test file.
 * This function only tests write permissions on the server using a single test file.
 *
 * @returns {Promise<Object>} Resolves to an object with success status and base filename for future use
 */
async function testDataSave() {
    console.log("==========================================");
    console.log("STARTING TEST SAVE PROCESS");

    const baseFilename = buildBaseFilename();
    console.log(`BASE FILENAME DETERMINED: ${baseFilename}`);

    // Check if this file already exists (for informational purposes only)
    // This helps predict what filename will actually be used later
    console.log("PRE-CHECKING IF FILE EXISTS (to predict final filename):");
    const fileExists = await checkFileExistsPromise(baseFilename);

    if (fileExists) {
        const timestamp = generateTimestamp();
        const predictedFilename = `${baseFilename}_${timestamp}`;
        console.log(
            `PREDICTION: File already exists, will use timestamped filename: ${predictedFilename}`,
        );
    } else {
        console.log(
            `PREDICTION: File does not exist, will use base filename: ${baseFilename}`,
        );
    }

    try {
        // Create test data that includes the base filename for debugging
        const testData = `Test save for ${baseFilename} at ${new Date().toISOString()}`;

        // Save to a special file named .test - this avoids creating unnecessary experiment data files
        // The .test file will be overwritten each time, so only one exists on the server
        console.log("PERFORMING TEST SAVE: Saving to .test file");

        return new Promise((resolve, reject) => {
            saveData(".test", testData, (isSuccessful, response) => {
                if (isSuccessful) {
                    console.log(
                        "TEST SAVE SUCCESSFUL: Data saved to .test file",
                    );

                    // Store the base filename and file existence status for future use
                    window.testedBaseFilename = baseFilename;
                    window.fileExistsStatus = fileExists;

                    if (fileExists) {
                        console.log(
                            `TEST SAVE COMPLETE: Will use base filename + timestamp: ${baseFilename}_TIMESTAMP`,
                        );
                    } else {
                        console.log(
                            `TEST SAVE COMPLETE: Will use base filename: ${baseFilename}`,
                        );
                    }

                    console.log("==========================================");
                    resolve({
                        success: true,
                        baseFilename: baseFilename,
                        fileExists: fileExists,
                    });
                } else {
                    console.error(
                        "TEST SAVE FAILED: Could not save to .test file",
                        response,
                    );
                    window.testSaveError = { error: "Test save failed" };
                    reject({
                        success: false,
                        error: response,
                    });
                }
            });
        });
    } catch (error) {
        console.error("TEST SAVE ERROR: Failed to save test data.", error);
        window.testSaveError = error; // Store the error
        return {
            success: false,
            error: error,
        };
    }
}

/**
 * Checks if a file exists by attempting to read it.
 * @param {string} filename - The name of the file to check
 * @returns {Promise<boolean>} - Resolves to true if the file exists, false otherwise
 */
function checkFileExistsPromise(filename) {
    console.log(`CHECKING FILE EXISTENCE: data/${filename}.csv`);

    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("HEAD", `data/${filename}.csv`, true);

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                const status = xhr.status;
                if (status === 200) {
                    console.log(
                        `FILE CHECK RESULT: File EXISTS (Status: ${status})`,
                    );
                    resolve(true); // File exists
                } else {
                    console.log(
                        `FILE CHECK RESULT: File does NOT exist (Status: ${status})`,
                    );
                    // Any other status, including 404, means file doesn't exist
                    resolve(false);
                }
            }
        };

        xhr.onerror = function (error) {
            console.error(`FILE CHECK ERROR:`, error);
            resolve(false); // Assume file doesn't exist on error
        };

        xhr.send();
    });
}

/**
 * Saves experiment data to CSV and handles redirect after completion.
 * Only creates one data file per experiment, with timestamp only if needed.
 *
 * @async
 * @function
 */
async function writeCsvRedirect() {
    console.log("==========================================");
    console.log("STARTING DATA SAVE PROCESS");

    const updatedScore =
        typeof score !== "undefined"
            ? score
            : jsPsych.data.get().select("score").values.slice(-1)[0];

    const updatedEarnings =
        typeof earnings !== "undefined"
            ? earnings
            : jsPsych.data.get().select("earnings").values.slice(-1)[0];

    console.log("Updated earnings", updatedEarnings);

    // If we have a test error, don't try to save
    if (window.testSaveError) {
        console.error("Using cached test error:", window.testSaveError);
        // Display error message
        const dataFailure = `
        <div class="error-page">
            <p>Oh no!</p>
            <p>An error has occurred and your data has not been saved:</p>
            <p>${window.testSaveError.error || "Unknown error"}</p>
            <p>Please wait for the experimenter to continue.</p>
        </div>`;
        document.querySelector("#jspsych-content").innerHTML = dataFailure;
        return;
    }

    // Generate the thank you message
    const thankYou = instructions[instructions.length - 1](
        updatedScore,
        updatedEarnings,
    );

    const baseFilename = window.testedBaseFilename || buildBaseFilename();
    if (!window.testedBaseFilename) {
        console.log("No pre-tested filename available, creating new one");
    }

    // If we already checked file existence during test, use that information
    let fileExists;
    if (typeof window.fileExistsStatus !== "undefined") {
        fileExists = window.fileExistsStatus;
        console.log(
            `USING CACHED FILE EXISTENCE STATUS: ${
                fileExists ? "File exists" : "File does not exist"
            }`,
        );
    } else {
        // Otherwise check if file already exists
        console.log("CHECKING EXISTING FILE before saving real data");
        fileExists = await checkFileExistsPromise(baseFilename);
    }

    // Determine final filename based on existence
    let finalFilename;
    if (fileExists) {
        const timestamp = generateTimestamp();
        finalFilename = `${baseFilename}_${timestamp}`;
        console.log(
            `File already exists - using timestamped filename: ${finalFilename}`,
        );
    } else {
        finalFilename = baseFilename;
        console.log(
            `File does not exist - using base filename: ${finalFilename}`,
        );
    }

    // Save data with properly determined filename
    console.log(`SAVING EXPERIMENT DATA as: ${finalFilename}.csv`);

    saveData(
        finalFilename,
        jsPsych.data.get().csv(),
        (isSuccessful, response) => {
            if (isSuccessful) {
                console.log(`DATA SAVE SUCCESSFUL: ${finalFilename}.csv`);
                // Update the stimulus content directly via DOM manipulation
                document.querySelector("#jspsych-content").innerHTML = thankYou;
                if (redirectLink) {
                    setTimeout(() => {
                        window.location.replace(redirectLink); // redirect after 5s
                    }, 5000);
                }
            } else {
                console.error(
                    `DATA SAVE FAILED for: ${finalFilename}.csv`,
                    response,
                );
                // Rest of the error handling
                let errorMessage = response.error || JSON.stringify(response);
                switch (errorMessage) {
                    case '{"success":false}':
                        errorMessage = `The ./data directory does not exit on this server.`;
                        break;
                    case "Not Found":
                        errorMessage = `There was an error saving the file to disk.`;
                        break;
                    default:
                        errorMessage = "Unknown error.";
                }
                const dataFailure = `
            <div class="error-page">
                <p>Oh no!</p>
                <p>An error has occurred and your data has not been saved:</p>
                <p>${errorMessage}</p>
                <p>Please wait for the experimenter to continue.</p>
            </div>`;
                document.querySelector("#jspsych-content").innerHTML =
                    dataFailure;
            }

            // These should happen regardless of success/failure
            if (document.getElementById("unload")) {
                document.getElementById("unload").onbeforeunload = ""; // Removes popup
            }
            document.body.classList.add("showCursor"); // Returns cursor functionality
            closeFullscreen(); // Kill fullscreen
            console.log("==========================================");
        },
    );
}

/**
 * Saves experiment data to MongoDB and handles redirect after completion.
 * Gets final score and earnings, displays thank you message, saves data to MongoDB,
 * and optionally redirects to a survey link.
 *
 * @async
 * @function
 * @side-effects {DOM} Updates page content with success/failure message
 * @side-effects {Storage} Saves experimental data to MongoDB
 * @side-effects {Navigation} May redirect to another URL after 5 seconds
 */
async function writeMongoRedirect() {
    const updatedScore =
        typeof score !== "undefined"
            ? score
            : jsPsych.data.get().select("score").values.slice(-1)[0];

    const updatedEarnings =
        typeof earnings !== "undefined"
            ? earnings
            : jsPsych.data.get().select("earnings").values.slice(-1)[0];

    console.log("updated earnings", updatedEarnings);

    // Generate the thank you message with the updated score and earnings
    const thankYou = instructions[instructions.length - 1](
        updatedScore,
        updatedEarnings,
    );

    try {
        // Await the saveMongo call to ensure data is saved before proceeding
        const response = await saveMongo();
        console.log("Data saved successfully to MongoDB.", response);

        // Display thank you message on the page
        document.querySelector("#jspsych-content").innerHTML = thankYou;
        if (redirectLink) {
            setTimeout(() => {
                window.location.replace(redirectLink); // Redirect after 5 seconds
            }, 5000);
        }
    } catch (error) {
        console.error("Failed to save data to MongoDB.", error);

        // Process error message for user display
        let errorMessage = error.message || "Unknown error.";
        if (errorMessage === '{"success":false}') {
            errorMessage =
                "The ./data directory does not exist on this server.";
        } else if (errorMessage === "Not Found") {
            errorMessage = "There was an error saving the file to MongoDB.";
        }

        // Display error message to user
        const dataFailure = `
            <div class="error-page">
                <p>Oh no!</p>
                <p>An error has occurred and your data has not been saved:</p>
                <p>${errorMessage}</p>
                <p>Please wait for the experimenter to continue.</p>
            </div>`;
        document.querySelector("#jspsych-content").innerHTML = dataFailure;
    } finally {
        document.getElementById("unload").onbeforeunload = ""; // Removes unload warning
        document.body.classList.add("showCursor"); // Show cursor again
        closeFullscreen(); // Exit fullscreen mode
    }
}

// redirect.js (loaded before fn.js) defines getRedirectLink; returns undefined when no identifier is present
const redirectLink = getRedirectLink(version, urlConfig);
/**
 * Gets the current browser window size.
 * Checks multiple properties to ensure cross-browser compatibility.
 *
 * @returns {Object} An object containing viewport dimensions
 * @returns {number} returns.width - The viewport width in pixels
 * @returns {number} returns.height - The viewport height in pixels
 */
const getViewportSize = () => {
    return {
        width:
            window.innerWidth ||
            document.documentElement.clientWidth ||
            document.body.clientWidth,
        height:
            window.innerHeight ||
            document.documentElement.clientHeight ||
            document.body.clientHeight,
    };
};

/**
 * Function from Brian Scholl's lab
 * Handles violations of experiment requirements like tab switching or exiting fullscreen.
 * Cleans up event listeners, displays termination message, and ends the experiment.
 *
 * @returns {void} This function doesn't return a value
 * @side-effects {DOM} Replaces entire document body with termination message
 * @side-effects {Event} Removes window.beforeunload event listener
 * @side-effects {jsPsych} Calls jsPsych.endExperiment()
 */
const multitaskingViolation = () => {
    // Remove any beforeunload listeners
    window.onbeforeunload = null;

    // End the experiment immediately
    document.body.innerHTML = `
        <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif; max-width: 600px; margin-left: auto; margin-right: auto;">
            <h2>Experiment Terminated</h2>
            <p>You switched tabs, clicked outside the browser, or exited fullscreen mode.</p>
            <p>Please refresh this browser page to start over.</p>
            <p style="color: #666; margin-top: 20px;">Note: Your progress was not saved.</p>
        </div>
    `;

    // End jsPsych
    jsPsych.endExperiment();
};
