"use strict";
const dotenv = require("dotenv");

dotenv.config();

const {
  API_URL,
  WORKER_URL,
  REDIS_HOST,
  REDIS_PORT,
  JWT_TOKEN_USERNAME,
  JWT_TOKEN_PASSWORD,
  ETHERSCAN_API_KEY,
} = process.env;

module.exports = {
  API_URL,
  WORKER_URL,
  REDIS_HOST,
  REDIS_PORT,
  JWT_TOKEN_USERNAME,
  JWT_TOKEN_PASSWORD,
  ETHERSCAN_API_KEY,
};
