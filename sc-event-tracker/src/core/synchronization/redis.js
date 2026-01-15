"use strict";
const os = require("node:os");
const { Redis } = require("ioredis");
const { logger } = require("../utils/logger");
const { v7: uuid } = require("uuid");
const { REDIS_HOST, REDIS_PORT } = require("../config/environment");

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
});

class SyncManager {
  /**
   * Creates a new instance of the SyncManager class.
   *
   * @param {Redis} rtStorage - The RTStorage instance to use for
   * synchronizing data.
   * @param {import("../utils/logger").Logger} loggerInstance - The logger instance to use for logging messages.
   */
  constructor(rtStorage, loggerInstance) {
    this.rtStorage = rtStorage;
    this.logger = loggerInstance;
    this.containerId = `${os.hostname()}-${uuid()}`;
  }

  /**
   * Builds a Redis key for a process entry. The key is
   * composed of the container ID and the index of the process.
   *
   * @param {string} containerId - The ID of the container.
   * @param {number} index - The index of the process.
   * @returns {string} The Redis key.
   */
  buildProcessKey(containerId, index) {
    return `container:${containerId}-process:${index}`;
  }

  /**
   * Builds a Redis key for a container entry. The key is composed of
   * the string "container:" followed by the container ID.
   *
   * @param {string} containerId - The ID of the container.
   * @returns {string} The Redis key.
   */
  buildContainerKey(containerId) {
    return `container:${containerId}`;
  }

  /**
   * Builds a Redis key for a container's processes entry. The key is
   * composed of the string "container-processes:" followed by the
   * container ID.
   *
   * @param {string} containerId - The ID of the container.
   * @returns {string} The Redis key.
   */
  buildContainerProcessesKey(containerId) {
    return `container-processes:${containerId}`;
  }
}

class SyncContainerManager extends SyncManager {
  /**
   * Registers the container with the RtStorage, which tracks the
   * last time the container was seen.
   *
   * @returns {Promise<void>}
   */
  async registerContainer() {
    await this.rtStorage.rpush("containers", this.containerId);
    this.logger.log(
      `Container ${this.containerId} registered with timestamp ${Date.now()}`
    );
  }

  /**
   * Retrieves a list of process indices for the current container from Redis storage.
   *
   * @returns {Promise<Array<string>>} A promise that resolves with an array of process indices.
   */

  async getContainerProcesses() {
    const processes = await this.rtStorage.lrange(
      this.buildContainerProcessesKey(this.containerId),
      0,
      -1
    );

    return processes;
  }

  /**
   * Retrieves a list of process indices for the current container from Redis storage.
   *
   * @param {string} id - The id of the container
   * @returns {Promise<Array<string>>} A promise that resolves with an array of process indices.
   */

  async getContainerProcessesById(id) {
    const processes = await this.rtStorage.lrange(
      this.buildContainerProcessesKey(id),
      0,
      -1
    );

    return processes;
  }

  /**
   * Retrieves all container IDs from Redis.
   *
   * @returns {Promise<Array<string>>} An array of container IDs.
   */
  async getContainers() {
    const containers = await this.rtStorage.lrange("containers", 0, -1);
    return containers;
  }

  /**
   * Removes the current container entry from the storage.
   *
   * @returns {Promise<void>} A promise that resolves when the container entry is removed.
   */

  async removeContainer() {
    await this.removeAllContainerProcesses(this.containerId);

    const removeContainerResult = await this.rtStorage.lrem(
      "containers",
      0,
      this.containerId
    );

    if (removeContainerResult > 0) {
      await this.removeContainer();
    }

    this.logger.log(
      `Container ${this.containerId} removed - timestamp ${Date.now()}`
    );
  }

  /**
   * Removes all containers from the Redis storage.
   *
   * @returns {Promise<void>} A promise that resolves when all containers are removed.
   */
  async removeAllContainers() {
    try {
      const allContainers = await this.getContainers();

      for (const container of allContainers) {
        await this.removeAllContainerProcesses(container);
      }

      await this.rtStorage.del("containers");

      this.logger.log("Containers removed");
    } catch (error) {
      this.logger.error(`Error removing containers: ${error.message}`);
    }
  }

  /**
   * Removes all processes associated with the given container ID from the
   * Redis storage. If there are any processes that were removed, the function
   * will call itself recursively to remove all processes.
   *
   * @param {string} id - The ID of the container to remove processes from.
   * @returns {Promise<void>} A promise that resolves when all processes are removed.
   */
  async removeAllContainerProcesses(id) {
    try {
      const removed = await this.rtStorage.del(
        this.buildContainerProcessesKey(id)
      );

      if (removed > 0) {
        await this.removeAllContainerProcesses(id);
      }

      this.logger.log(`Container processes removed for container ${id}`);
    } catch (error) {
      this.logger.error(`Error removing container processes: ${error.message}`);
    }
  }

  /**
   * Removes the container with the specified ID from the storage.
   *
   * @param {string} id - The ID of the container to be removed.
   * @returns {Promise<void>} A promise that resolves when the container entry is removed.
   */

  async removeContainerById(id) {
    await this.removeAllContainerProcesses(id);

    const removeContainerResult = await this.rtStorage.lrem(
      "containers",
      0,
      id
    );

    if (removeContainerResult > 0) {
      await this.removeContainerById(id);
    }

    this.logger.log(`Container ${id} removed - timestamp ${Date.now()}`);
  }
}

class SyncProcessManager extends SyncContainerManager {
  /**
   * Registers a process with the RtStorage, which tracks the last
   * time the process was seen.
   *
   * @param {string} index - The index of the process to be registered
   * @param {number} pid - The process id of the process to be registered
   * @param {import("../event/workflow-event").WorkflowEvent} event - The event that the process is listening for
   * @returns {Promise<void>} A promise that resolves when the process entry is registered
   */
  async registerProcess(index, pid, event) {
    try {
      await this.rtStorage.hset(this.buildProcessKey(this.containerId, index), {
        containerId: this.containerId,
        pid,
        event: event.id,
        timestamp: Date.now(),
      });

      this.logger.log(
        `Process [${index}] registered with pid ${pid} and event ${event.id} - container ${this.containerId}`
      );

      await this.rtStorage.rpush(
        this.buildContainerProcessesKey(this.containerId),
        index
      );
    } catch (error) {
      this.logger.error(
        `Error registering process [${index}]: ${error.message}`
      );
    }
  }

  /**
   * Retrieves a process entry from the Redis storage.
   *
   * @param {string} index - The index of the process to be retrieved.
   * @returns {Promise<{containerId: string, pid: number, event: string, timestamp: number}|null>} A promise that resolves with the process entry if found, or null if not found.
   */

  async getProcess(index) {
    const processKey = this.buildProcessKey(this.containerId, index);

    const eventId = await this.rtStorage.hget(processKey, "event");
    const containerId = await this.rtStorage.hget(processKey, "containerId");
    const pid = await this.rtStorage.hget(processKey, "pid");
    const timestamp = await this.rtStorage.hget(processKey, "timestamp");

    return {
      containerId,
      pid,
      event: eventId,
      timestamp,
    };
  }

  /**
   * Retrieves a process entry from the Redis storage by providing the container ID.
   *
   * @param {string} containerId - The ID of the container.
   * @param {string} index - The index of the process to be retrieved.
   * @returns {Promise<{containerId: string, pid: number, event: string, timestamp: number}|null>} A promise that resolves with the process entry if found, or null if not found.
   */
  async getProcessByContainer(containerId, index) {
    const processKey = this.buildProcessKey(containerId, index);
    const eventId = await this.rtStorage.hget(processKey, "event");
    const containerData = await this.rtStorage.hget(processKey, "containerId");
    const pid = await this.rtStorage.hget(processKey, "pid");
    const timestamp = await this.rtStorage.hget(processKey, "timestamp");

    return {
      containerId: containerData,
      pid,
      event: eventId,
      timestamp,
    };
  }

  /**
   * Removes a process entry from the storage and updates the container's process list.
   *
   * @param {string} index - The index of the process to be removed.
   * @returns {Promise<void>} A promise that resolves when the process entry is removed.
   */
  async removeProcess(index) {
    try {
      const processKey = this.buildProcessKey(this.containerId, index);
      const containerProcessesKey = this.buildContainerProcessesKey(
        this.containerId
      );

      const removedHashes = await this.rtStorage.del(processKey);

      if (removedHashes > 0) {
        await this.removeProcess(index);
      }

      const removedProcess = await this.rtStorage.lrem(
        containerProcessesKey,
        0,
        index
      );

      if (removedProcess > 0) {
        await this.removeProcess(index);
      }

      this.logger.log(
        `Process [${index}] removed from container ${this.containerId}`
      );
    } catch (error) {
      this.logger.error(`Error removing process [${index}]: ${error.message}`);
    }
  }
}

class SyncModule extends SyncProcessManager {
  /**
   * Checks if a Keeper with the given index is running on this container.
   *
   * @param {string} index - The index of the Keeper to check.
   * @returns {Promise<boolean>} A promise that resolves to true if the Keeper is running, false otherwise.
   */
  async isWorkflowRuningOnThisContainer(index) {
    try {
      const containerProcesses = await this.getContainerProcesses();

      const keeperProcess = await this.getProcess(index);

      return containerProcesses.includes(keeperProcess.event);
    } catch (error) {
      this.logger.error(
        `Error checking if Keeper is running on this container: ${error.message}`
      );
    }
  }

  /**
   * Checks if a Keeper with the given index is already running on any of the
   * registered containers.
   *
   * @param {string} index - The index of the Keeper to check.
   * @returns {Promise<boolean>} A promise that resolves to true if the
   * Keeper is already running, false otherwise.
   */
  async isWorkflowAlreadyRunningInAnotherContainer(index) {
    try {
      let keeperAlreadyRunning = false;
      const containersRegistered = await this.getContainers();

      for (const container of containersRegistered) {
        if (container === this.containerId) {
          continue;
        }

        const containerProcesses =
          await this.getContainerProcessesById(container);

        if (containerProcesses.includes(index)) {
          keeperAlreadyRunning = true;
          break;
        }
      }

      return keeperAlreadyRunning;
    } catch (error) {
      this.logger.error(
        `Error checking if Keeper is running on this container: ${error.message}`
      );
    }
  }
}

const syncModule = new SyncModule(redis, logger);

module.exports = { syncModule, SyncModule };
