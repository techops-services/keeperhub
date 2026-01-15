const express = require("express");
const bodyParser = require("body-parser");

const { httpService } = require("./src/services/http-service.js");
const {
  KEEPERHUB_API_URL,
  PORT,
  TIMEOUT_BETWEEN_SYNC,
} = require("./src/config/environment.js");
const { logger } = require("./src/config/logger.js");

const app = express();

app.use(bodyParser.json());

const synchronizedData = {
  workflows: [],
  networks: {},
};

/**
 * Fetches active workflows from the API server
 *
 * @throws {Error} If the API request fails.
 */
async function fetchData() {
  try {
    const { workflows, networks } = await await httpService.get(
      `${KEEPERHUB_API_URL}/api/workflows/events?active=true`
    );

    synchronizedData.workflows = workflows;
    synchronizedData.networks = networks;

    logger.log(`${synchronizedData.workflows.length} active workflows`);
    logger.log(`Service active - uptime: ${process.uptime()}`);
  } catch (error) {
    logger.error("Error fetching data:", error.message);
  }
}

// Initial fetch to check for existing workflows
fetchData();

// Periodically fetch data every 30 seconds (30000 milliseconds)
setInterval(fetchData, TIMEOUT_BETWEEN_SYNC);

app.get("/data", (_, res) => {
  logger.log(
    `${JSON.stringify(synchronizedData.workflows.length)} active workflows`
  );

  res.json(synchronizedData);
});

app.post("/workflow/:id/execute", async (req, res) => {
  const { ...payload } = req.body;

  const { id } = req.params;

  try {
    const response = await (await httpService.authorize()).post(
      `${KEEPERHUB_API_URL}/api/workflow/${id}/execute`,
      payload
    );

    return res.status(200).json(response);
  } catch (error) {
    logger.error(error.message);
    return res.status(500).json({ error: "Error executing workflow" });
  }
});

// Endpoint to force immediate data refresh when workflows are updated
app.post("/refresh", async (_, res) => {
  try {
    logger.log("Manual refresh listeners triggered");
    await fetchData();
    res.json({
      status: "success",
      message: "Data refreshed successfully",
      workflows: synchronizedData.workflows.length,
    });
  } catch (error) {
    logger.error(error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.listen(PORT, () => {
  logger.log(`Worker service running on port ${PORT}`);
});
