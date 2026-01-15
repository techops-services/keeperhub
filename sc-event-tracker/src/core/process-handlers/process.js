"use strict";
const { WorkflowHandler } = require("./index.js");
const { WorkflowEvent } = require("../event/workflow-event.js");

/**
 * Removes child processes that are not active workflows. This function is used
 * to clean up stale processes after fetching the list of active keepers.
 * @param {Object} options - The options object
 * @param {Array<WorkflowEvent>} options.workflows - The list of active workflows fetched
 *                                             from the service.
 * @param {Object<string, {process: import('child_process').ChildProcess, handler: WorkflowHandler}>} options.childProcesses -
 *                                                                              The current list of
 *                                                                              running child processes.
 * @param {Object} options.syncService - The synchronization service
 * @param {Object} options.logger - The logger instance
 */
async function removeExcessProcesses({
  workflows,
  childProcesses,
  syncService,
  logger,
}) {
  const activeKeys = Object.keys(childProcesses);
  const workflowIds = new Set(workflows.map((workflow) => workflow.id));

  // Only remove processes if we have active workflows to compare against
  if (workflows.length > 0) {
    await Promise.all(
      activeKeys
        .filter((processId) => !workflowIds.has(processId))
        .map(async (excessProcessId) => {
          try {
            logger.log(
              `REMOVING EXCESS PROCESS: [ ${excessProcessId} ] - This workflow is no longer an active workflow`
            );
            const excessProcess = childProcesses[excessProcessId];

            if (excessProcess?.process && !excessProcess.process.killed) {
              logger.log(
                `KILLING PROCESS: [ ${excessProcessId} ] - Process PID: ${excessProcess.process.pid}`
              );
              excessProcess.handler.killWorkflow({ shouldRestart: false });
            }

            await syncService.removeProcess(excessProcessId);
            delete childProcesses[excessProcessId];
            logger.log(
              `PROCESS REMOVED: [ ${excessProcessId} ] - Successfully cleaned up`
            );
          } catch (error) {
            logger.error(
              `ERROR REMOVING PROCESS [${excessProcessId}]: ${error.message}`
            );
          }
        })
    );
  }
}

/**
 * Checks if a workflow is running elsewhere or on this container.
 * @param {string} workflowId - The workflow ID to check
 * @param {Object} syncService - The synchronization service
 * @returns {Promise<{runningElsewhere: boolean, runningOnThisContainer: boolean}>}
 */
async function checkWorkflowStatus(workflowId, syncService) {
  const runningElsewhere =
    await syncService.isWorkflowAlreadyRunningInAnotherContainer(workflowId);
  const isWorkflowRunningOnThisContainer =
    await syncService.isWorkflowRuningOnThisContainer(workflowId);

  return {
    runningElsewhere,
    runningOnThisContainer: isWorkflowRunningOnThisContainer,
  };
}

/**
 * Creates a new WorkflowHandler instance for an event.
 * @param {Object} event - The workflow event
 * @param {Object<string, Network>} networks - The map of networks by chainId
 * @param {Object} logger - The logger instance
 * @param {Object} syncService - The synchronization service
 * @returns {WorkflowHandler}
 */
function createWorkflowHandler(event, networks, logger, syncService) {
  const workflowEvent = new WorkflowEvent(event);
  return new WorkflowHandler({
    event: workflowEvent,
    logger,
    syncService,
    index: event.id,
    networks,
    rawEventData: event,
  });
}

/**
 * Determines if an existing process should be restarted.
 * @param {Object} existingProcess - The existing process handler
 * @param {Object} event - The workflow event
 * @param {boolean} runningElsewhere - Whether the workflow is running elsewhere
 * @returns {boolean}
 */
function shouldRestartExistingProcess(
  existingProcess,
  event,
  runningElsewhere
) {
  if (runningElsewhere) {
    return false;
  }
  return existingProcess.handler.event.hasConfigurationChanged(event);
}

/**
 * Restarts an existing process with a new event.
 * @param {Object} existingProcess - The existing process handler
 * @param {WorkflowEvent} workflowEvent - The new workflow event
 * @param {Object} event - The raw event data
 * @param {Object} logger - The logger instance
 * @returns {Promise<Object>} The restarted handler's current process
 */
async function restartExistingProcess(
  existingProcess,
  workflowEvent,
  event,
  logger
) {
  logger.log(
    `Process [ ${existingProcess.process.pid} ] has different configuration. Restarting KeeperEvent: ${event.name} - ${event.id}`
  );

  const restartedHandler =
    await existingProcess.handler.restartWorkflowWithAnotherEvent(
      workflowEvent,
      event
    );

  return restartedHandler.currentProcess;
}

/**
 * Handles an existing process - checks if it needs restarting or can continue.
 * @param {Object} options - The options object
 * @param {Object} options.existingProcess - The existing process handler
 * @param {Object} options.event - The workflow event
 * @param {WorkflowEvent} options.workflowEvent - The workflow event instance
 * @param {boolean} options.runningElsewhere - Whether the workflow is running elsewhere
 * @param {boolean} options.runningOnThisContainer - Whether the workflow is running on this container
 * @param {Object} options.logger - The logger instance
 * @returns {Promise<{handled: boolean, newProcess?: Object}>}
 */
async function handleExistingProcess({
  existingProcess,
  event,
  workflowEvent,
  runningElsewhere,
  runningOnThisContainer,
  logger,
}) {
  if (runningElsewhere) {
    logger.log(`Workflow ${event.id} is already running in another container`);
    return { handled: true };
  }

  const configurationChanged = shouldRestartExistingProcess(
    existingProcess,
    event,
    runningElsewhere
  );

  if (configurationChanged) {
    const newProcess = await restartExistingProcess(
      existingProcess,
      workflowEvent,
      event,
      logger
    );
    return { handled: true, newProcess };
  }

  if (!existingProcess.process.killed && runningOnThisContainer) {
    logger.log(
      `PROCESS ACTIVE: [ ${existingProcess.process.pid} ] is already active and up-to-date. WorkflowEvent: ${event.name} - ${event.id} (trigger_type: ${event.eventName})`
    );
    return { handled: true };
  }

  return { handled: false };
}

/**
 * Starts a new workflow process.
 * @param {WorkflowHandler} workflowHandler - The workflow handler
 * @param {Object} event - The workflow event
 * @param {Object} logger - The logger instance
 * @returns {Promise<Object>} The current process
 */
async function startNewProcess(workflowHandler, event, logger) {
  logger.log(
    `Starting or restarting child process for WorkflowEvent: ${event.name} - ${event.id}`
  );

  await workflowHandler.startProcess();
  return workflowHandler.currentProcess;
}

/**
 * Handles a single workflow event.
 * @param {Object} options - The options object
 * @param {Object} options.event - The workflow event
 * @param {Object<string, {process: import('child_process').ChildProcess, handler: WorkflowHandler}>} options.childProcesses - The current list of running child processes
 * @param {Object<string, Network>} options.networks - The map of networks by chainId
 * @param {Object} options.syncService - The synchronization service
 * @param {Object} options.logger - The logger instance
 * @returns {Promise<Object|undefined>} The new process if one was created/restarted
 */
async function handleWorkflowEvent({
  event,
  childProcesses,
  networks,
  syncService,
  logger,
}) {
  const { runningElsewhere, runningOnThisContainer } =
    await checkWorkflowStatus(event.id, syncService);

  if (runningElsewhere) {
    return;
  }

  const existingProcess = childProcesses[event.id];
  const workflowEvent = new WorkflowEvent(event);
  const workflowHandler = createWorkflowHandler(
    event,
    networks,
    logger,
    syncService
  );

  if (existingProcess) {
    const result = await handleExistingProcess({
      existingProcess,
      event,
      workflowEvent,
      runningElsewhere,
      runningOnThisContainer,
      logger,
    });

    if (result.handled) {
      if (result.newProcess) {
        return result.newProcess;
      }
      return;
    }
  }

  return await startNewProcess(workflowHandler, event, logger);
}

/**
 * Handles a list of active workflows by either starting a new process or
 * updating an existing process.
 *
 * @param {Object} options - The options object
 * @param {Array<WorkflowEvent>} options.workflows - The list of active workflows fetched
 *                                             from the service.
 * @param {Object<string, {process: import('child_process').ChildProcess, handler: WorkflowHandler}>} options.childProcesses -
 *                                                                              The current list of
 *                                                                              running child processes.
 * @param {Object<string, Network>} options.networks - The map of networks by chainId fetched
 *                                             from the service.
 * @param {Object} options.syncService - The synchronization service
 * @param {Object} options.logger - The logger instance
 */
async function handleActiveWorkflows({
  workflows,
  childProcesses,
  networks,
  syncService,
  logger,
}) {
  const containersRegistered = await syncService.getContainers();

  for (const container of containersRegistered) {
    const _processes = await syncService.getContainerProcessesById(container);
  }

  for (const event of workflows) {
    try {
      const newProcess = await handleWorkflowEvent({
        event,
        childProcesses,
        networks,
        syncService,
        logger,
      });

      if (newProcess) {
        childProcesses[event.id] = newProcess;
      }
    } catch (error) {
      console.log(error);
      logger.error(
        `Error while handling active workflow [${event.id}]: ${error.message}`
      );
    }
  }
}

module.exports = { removeExcessProcesses, handleActiveWorkflows };
