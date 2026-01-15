"use strict";
const dotenv = require("dotenv");

dotenv.config();

const {
  KEEPERHUB_API_URL,
  WORKER_URL,
  REDIS_HOST,
  REDIS_PORT,
  JWT_TOKEN_USERNAME,
  JWT_TOKEN_PASSWORD,
  ETHERSCAN_API_KEY,
} = process.env;

module.exports = {
  KEEPERHUB_API_URL,
  WORKER_URL,
  REDIS_HOST,
  REDIS_PORT,
  JWT_TOKEN_USERNAME,
  JWT_TOKEN_PASSWORD,
  ETHERSCAN_API_KEY,
};
