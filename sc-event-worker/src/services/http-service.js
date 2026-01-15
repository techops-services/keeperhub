const { default: axios } = require("axios");
const {
  JWT_TOKEN_USERNAME,
  JWT_TOKEN_PASSWORD,
  KEEPERHUB_API_URL,
  KEEPERHUB_API_KEY,
} = require("../config/environment.js");

class HttpService {
  async get(url) {
    const { data } = await axios.get(url, {
      headers: this.getHeaders(),
    });

    return data;
  }

  async post(url, data) {
    const { data: response } = await axios.post(url, data, {
      headers: this.getHeaders(),
    });

    return response;
  }

  /**
   * Authorize the http service to use the API by retrieving an access token
   * using the provided JWT token username and password.
   *
   * @returns {Promise<HttpService>} this
   */
  async authorize() {
    const payload = new URLSearchParams();
    payload.append("username", JWT_TOKEN_USERNAME);
    payload.append("password", JWT_TOKEN_PASSWORD);

    const url = `${KEEPERHUB_API_URL}/auth/token`;
    const { data } = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    this.accessToken = data.access_token;

    return this;
  }

  /**
   *
   * @returns {object}
   *
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      "X-Internal-Token": KEEPERHUB_API_KEY,
    };
  }
}

const httpService = new HttpService();

module.exports = { httpService };
