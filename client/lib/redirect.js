function getParamFromUrl(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    const regexS = "[?&]" + name + "=([^&#]*)";
    const regex = new RegExp(regexS);
    const results = regex.exec(window.location.href);
    if (results == null) return undefined;
    else return decodeURIComponent(results[1].replace(/\+/g, " "));
}

function counterbalanceParticipants(inputString, modulus) {
    const digits = inputString.match(/\d/g);
    const sum = digits ? digits.reduce((acc, digit) => acc + parseInt(digit), 0) : null;
    if (sum === null) {
        alert(`The ${identifierType} must contain digits for counterbalancing.\nCounterbalancing is disabled. If you would like to continue, only the first redirect condition will be used as fallback: ${urlConfig[version][0]}`);
        return null;
    }
    return sum % modulus;
}

// Identifier configuration
const identifierConfig = [
    { type: "workerId", value: getParamFromUrl("workerId") },
    { type: "PROLIFIC_PID", value: getParamFromUrl("PROLIFIC_PID") },
    { type: "participantId", value: getParamFromUrl("participantId") },
];

// Function to determine the identifier and its type
function getIdentifierInfo() {
    for (const { type, value } of identifierConfig) {
        if (value) {
            return { type, value };
        }
    }
    return { type: null, value: null };
}

// Use the function to set identifier and identifierType
const { type: identifierType, value: identifier } = getIdentifierInfo();

// Function to get feedback link
function getRedirectLink(version, urlConfig) {
    if (!identifier || !identifierType) return undefined;

    // Default to "default" if version is not provided
    const selectedVersion = version || "default";

    // Check if urlConfig[selectedVersion] exists
    if (urlConfig[selectedVersion]) {
        // Check if urlConfig[selectedVersion] is nested (object) or not
        if (typeof urlConfig[selectedVersion] === "object") {
            // It's a nested structure, calculate the modulus based on the number of keys

            // if modulus is not declared in conf, getRedirectLink() sets:
            if (typeof modulus === "undefined") {
                modulus = Object.keys(urlConfig[selectedVersion]).length;
            }

            // if phase is not declared in conf, getRedirectLink() sets :
            if (typeof phase === "undefined") {
                phase = counterbalanceParticipants(identifier, modulus);
            }

            // Select the redirect path based on phase
            redirectPath = urlConfig[selectedVersion][phase];
        } else {
            // It's not nested, use the flat link
            redirectPath = urlConfig[selectedVersion];
        }
    } else {
        console.error(`Version "${selectedVersion}" not found in urlConfig.`);
        // Fallback to the default redirect path if version not found
        redirectPath = urlConfig.default;
    }

    // Create the final redirect link
    let link = `${redirectPath}?${identifierType}=${identifier}`;

    // Include phase if it exists
    if (phase || phase > -1) {
        link += `&phase=${phase}`;
    }

    return link;
}
