let counter = 0;

function nanoid() {
    counter += 1;
    return `testid${counter}`;
}

module.exports = { nanoid };
