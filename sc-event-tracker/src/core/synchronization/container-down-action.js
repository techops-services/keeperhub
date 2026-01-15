"use strict";
const { syncModule } = require("./redis");

async function main() {
  return await syncModule.removeContainer();
}

main();
