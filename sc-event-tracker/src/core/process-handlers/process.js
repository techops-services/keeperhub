"use strict";
const { WorkflowHandler } = require("./index.js");
const { WorkflowEvent } = require("../event/WorkflowEvent");
const { syncModule } = require("../synchronization/redis");
const { logger } = require("../utils/logger");

/**
 * Removes child processes that are not active workflows. This function is used
 * to clean up stale processes after fetching the list of active keepers.
 * @param {Array<WorkflowEvent>} workflows - The list of active workflows fetched
 *                                             from the service.
 * @param {Object<string, {process: import('child_process').ChildProcess, handler: WorkflowHandler}>} childProcesses -
 *                                                                              The current list of
 *                                                                              running child processes.
 */
async function removeExcessProcesses(workflows, childProcesses) {
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

            await syncModule.removeProcess(excessProcessId);
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
 * Handles a list of active workflows by either starting a new process or
 * updating an existing process.
 *
 * @param {Array<WorkflowEvent>} workflows - The list of active workflows fetched
 *                                             from the service.
 * @param {Object<string, {process: import('child_process').ChildProcess, handler: WorkflowHandler}>} childProcesses -
 *                                                                              The current list of
 *                                                                              running child processes.
 * @param {Object<string, Network>} networks - The map of networks by chainId fetched
 *                                             from the service.
 */
async function handleActiveWorkflows(workflows, childProcesses, networks) {
  const containersRegistered = await syncModule.getContainers();

  // console.log("containersRegistered", containersRegistered);

  for (const container of containersRegistered) {
    const processes = await syncModule.getContainerProcessesById(container);

    // console.log("processes", processes);
  }

  for (const event of workflows) {
    try {
      const runningElsewhere =
        await syncModule.isWorkflowAlreadyRunningInAnotherContainer(event.id);

      const isWorkflowRunningOnThisContainer =
        await syncModule.isWorkflowRuningOnThisContainer(event.id);

      if (runningElsewhere) continue;

      const existingProcess = childProcesses[event.id];

      const workflowEvent = new WorkflowEvent(event);
      const workflowHandler = new WorkflowHandler({
        event: workflowEvent,
        logger,
        syncService: syncModule,
        index: event.id,
        networks,
        rawEventData: event, // Pass original event data for serialization
      });

      if (existingProcess) {
        const configurationChanged =
          existingProcess.handler.event.hasConfigurationChanged(event);

        const shouldRestart = !runningElsewhere && configurationChanged;

        // Check if the event is different from the existing one
        if (shouldRestart) {
          logger.log(
            `Process [ ${existingProcess.process.pid} ] has different configuration. Restarting KeeperEvent: ${event.name} - ${event.id}`
          );

          const workflowHandler =
            await existingProcess.handler.restartWorkflowWithAnotherEvent(
              workflowEvent,
              event // Pass raw event data for serialization
            );

          childProcesses[event.id] = workflowHandler.currentProcess;
          continue;
        }
        if (runningElsewhere) {
          logger.log(
            `Workflow ${event.id} is already running in another container`
          );
          continue;
        }
        if (
          !existingProcess.process.killed &&
          isWorkflowRunningOnThisContainer
        ) {
          // If no differences and process is active, continue
          logger.log(
            `PROCESS ACTIVE: [ ${existingProcess.process.pid} ] is already active and up-to-date. WorkflowEvent: ${event.name} - ${event.id} (trigger_type: ${event.eventName})`
          );
          continue;
        }
      }

      logger.log(
        `Starting or restarting child process for WorkflowEvent: ${event.name} - ${event.id}`
      );

      await workflowHandler.startProcess();

      childProcesses[event.id] = workflowHandler.currentProcess;
    } catch (error) {
      console.log(error);
      logger.error(
        `Error while handling active workflow [${event.id}]: ${error.message}`
      );
    }
  }
}

module.exports = { removeExcessProcesses, handleActiveWorkflows };
