const dotenv = require("dotenv");

dotenv.config();

const {
  API_URL,
  TIMEOUT_BETWEEN_SYNC,
  JWT_TOKEN_USERNAME,
  JWT_TOKEN_PASSWORD,
  PORT,
  INTERNAL_API_TOKEN,
} = process.env;

module.exports = {
  API_URL,
  TIMEOUT_BETWEEN_SYNC,
  JWT_TOKEN_USERNAME,
  JWT_TOKEN_PASSWORD,
  PORT: PORT || 3010,
  INTERNAL_API_TOKEN,
};
