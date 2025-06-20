import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ActionResult, AgentContext, type AgentOptions } from './types';
import { NavigatorAgent, NavigatorActionRegistry } from './agents/navigator';
import { PlannerAgent, type PlannerOutput } from './agents/planner';
import { ValidatorAgent } from './agents/validator';
import { NavigatorPrompt } from './prompts/navigator';
import { PlannerPrompt } from './prompts/planner';
import { ValidatorPrompt } from './prompts/validator';
import { createLogger } from '@src/background/log';
import MessageManager from './messages/service';
import type BrowserContext from '../browser/context';
import { ActionBuilder } from './actions/builder';
import { EventManager } from './event/manager';
import { Actors, type EventCallback, EventType, ExecutionState } from './event/types';
import { ChatModelAuthError, ChatModelForbiddenError, RequestCancelledError } from './agents/errors';
import { wrapUntrustedContent } from './messages/utils';
import { URLNotAllowedError } from '../browser/views';
import { chatHistoryStore } from '@extension/storage/lib/chat';
import type { AgentStepHistory } from './history';

const logger = createLogger('Executor');

interface ParsedModelOutput {
  current_state?: {
    next_goal?: string;
  };
  action?: (Record<string, unknown> | null)[] | null;
}

export interface ExecutorExtraArgs {
  plannerLLM?: BaseChatModel;
  validatorLLM?: BaseChatModel;
  extractorLLM?: BaseChatModel;
  agentOptions?: Partial<AgentOptions>;
}

export class Executor {
  private readonly navigator: NavigatorAgent;
  private readonly planner: PlannerAgent;
  private readonly validator: ValidatorAgent;
  private readonly context: AgentContext;
  private readonly plannerPrompt: PlannerPrompt;
  private readonly navigatorPrompt: NavigatorPrompt;
  private readonly validatorPrompt: ValidatorPrompt;
  private tasks: string[] = [];
  constructor(
    task: string,
    taskId: string,
    browserContext: BrowserContext,
    navigatorLLM: BaseChatModel,
    extraArgs?: Partial<ExecutorExtraArgs>,
  ) {
    const messageManager = new MessageManager();

    const plannerLLM = extraArgs?.plannerLLM ?? navigatorLLM;
    const validatorLLM = extraArgs?.validatorLLM ?? navigatorLLM;
    const extractorLLM = extraArgs?.extractorLLM ?? navigatorLLM;
    const eventManager = new EventManager();
    const context = new AgentContext(
      taskId,
      browserContext,
      messageManager,
      eventManager,
      extraArgs?.agentOptions ?? {},
    );

    this.tasks.push(task);
    this.navigatorPrompt = new NavigatorPrompt(context.options.maxActionsPerStep);
    this.plannerPrompt = new PlannerPrompt();
    this.validatorPrompt = new ValidatorPrompt(task);

    const actionBuilder = new ActionBuilder(context, extractorLLM);
    const navigatorActionRegistry = new NavigatorActionRegistry(actionBuilder.buildDefaultActions());

    // Initialize agents with their respective prompts
    this.navigator = new NavigatorAgent(navigatorActionRegistry, {
      chatLLM: navigatorLLM,
      context: context,
      prompt: this.navigatorPrompt,
    });

    this.planner = new PlannerAgent({
      chatLLM: plannerLLM,
      context: context,
      prompt: this.plannerPrompt,
    });

    this.validator = new ValidatorAgent({
      chatLLM: validatorLLM,
      context: context,
      prompt: this.validatorPrompt,
    });

    this.context = context;
    // Initialize message history
    this.context.messageManager.initTaskMessages(this.navigatorPrompt.getSystemMessage(), task);
  }

  subscribeExecutionEvents(callback: EventCallback): void {
    this.context.eventManager.subscribe(EventType.EXECUTION, callback);
  }

  clearExecutionEvents(): void {
    // Clear all execution event listeners
    this.context.eventManager.clearSubscribers(EventType.EXECUTION);
  }

  addFollowUpTask(task: string): void {
    this.tasks.push(task);
    this.context.messageManager.addNewTask(task);
    // update validator prompt
    this.validatorPrompt.addFollowUpTask(task);

    // need to reset previous action results that are not included in memory
    this.context.actionResults = this.context.actionResults.filter(result => result.includeInMemory);
  }

  /**
   * Execute the task
   *
   * @returns {Promise<void>}
   */
  async execute(): Promise<void> {
    logger.info(`🚀 Executing task: ${this.tasks[this.tasks.length - 1]}`);
    // reset the step counter
    const context = this.context;
    context.nSteps = 0;
    const allowedMaxSteps = this.context.options.maxSteps;

    try {
      this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_START, this.context.taskId);

      let done = false;
      let step = 0;
      let validatorFailed = false;
      let webTask = undefined;
      for (step = 0; step < allowedMaxSteps; step++) {
        context.stepInfo = {
          stepNumber: context.nSteps,
          maxSteps: context.options.maxSteps,
        };

        logger.info(`🔄 Step ${step + 1} / ${allowedMaxSteps}`);
        if (await this.shouldStop()) {
          break;
        }

        // Run planner if configured
        if (this.planner && (context.nSteps % context.options.planningInterval === 0 || validatorFailed)) {
          validatorFailed = false;
          // The first planning step is special, we don't want to add the browser state message to memory
          let positionForPlan = 0;
          if (this.tasks.length > 1 || step > 0) {
            await this.navigator.addStateMessageToMemory();
            positionForPlan = this.context.messageManager.length() - 1;
          } else {
            positionForPlan = this.context.messageManager.length();
          }

          const planOutput = await this.planner.execute();
          if (planOutput.result) {
            // logger.info(`🔄 Planner output: ${JSON.stringify(planOutput.result, null, 2)}`);
            // observation in planner is untrusted content, they are not instructions
            const observation = wrapUntrustedContent(planOutput.result.observation);
            const plan: PlannerOutput = {
              ...planOutput.result,
              observation,
            };
            this.context.messageManager.addPlan(JSON.stringify(plan), positionForPlan);

            if (webTask === undefined) {
              // set the web task, and keep it not change from now on
              webTask = planOutput.result.web_task;
            }

            if (planOutput.result.done) {
              // task is complete, skip navigation
              done = true;
              this.validator.setPlan(planOutput.result.next_steps);
            } else {
              // task is not complete, let's navigate
              this.validator.setPlan(null);
              done = false;
            }

            if (!webTask && planOutput.result.done) {
              break;
            }
          }
        }

        // execute the navigation step
        if (!done) {
          done = await this.navigate();
        }

        // validate the output
        if (done && this.context.options.validateOutput && !this.context.stopped && !this.context.paused) {
          const validatorOutput = await this.validator.execute();
          if (validatorOutput.result?.is_valid) {
            logger.info('✅ Task completed successfully');
            break;
          }
          validatorFailed = true;
          context.consecutiveValidatorFailures++;
          if (context.consecutiveValidatorFailures >= context.options.maxValidatorFailures) {
            logger.error(`Stopping due to ${context.options.maxValidatorFailures} consecutive validator failures`);
            throw new Error('Too many failures of validation');
          }
        }
      }

      if (done) {
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_OK, this.context.taskId);
      } else if (step >= allowedMaxSteps) {
        logger.info('❌ Task failed: Max steps reached');
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_FAIL, 'Task failed: Max steps reached');
      } else if (this.context.stopped) {
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_CANCEL, 'Task cancelled');
      } else {
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_PAUSE, 'Task paused');
      }
    } catch (error) {
      if (error instanceof RequestCancelledError) {
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_CANCEL, 'Task cancelled');
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_FAIL, `Task failed: ${errorMessage}`);
      }
    } finally {
      if (import.meta.env.DEV) {
        logger.debug('Executor history', JSON.stringify(this.context.history, null, 2));
      }
      // store the history
      await chatHistoryStore.storeAgentStepHistory(this.context.taskId, JSON.stringify(this.context.history));
    }
  }

  private async navigate(): Promise<boolean> {
    const context = this.context;
    try {
      // Get and execute navigation action
      // check if the task is paused or stopped
      if (context.paused || context.stopped) {
        return false;
      }
      const navOutput = await this.navigator.execute();
      // check if the task is paused or stopped
      if (context.paused || context.stopped) {
        return false;
      }
      context.nSteps++;
      if (navOutput.error) {
        throw new Error(navOutput.error);
      }
      context.consecutiveFailures = 0;
      if (navOutput.result?.done) {
        return true;
      }
    } catch (error) {
      logger.error(`Failed to execute step: ${error}`);
      if (
        error instanceof ChatModelAuthError ||
        error instanceof ChatModelForbiddenError ||
        error instanceof URLNotAllowedError ||
        error instanceof RequestCancelledError
      ) {
        throw error;
      }
      context.consecutiveFailures++;
      logger.error(`Failed to execute step: ${error}`);
      if (context.consecutiveFailures >= context.options.maxFailures) {
        throw new Error('Max failures reached');
      }
    }
    return false;
  }

  private async shouldStop(): Promise<boolean> {
    if (this.context.stopped) {
      logger.info('Agent stopped');
      return true;
    }

    while (this.context.paused) {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (this.context.stopped) {
        return true;
      }
    }

    if (this.context.consecutiveFailures >= this.context.options.maxFailures) {
      logger.error(`Stopping due to ${this.context.options.maxFailures} consecutive failures`);
      return true;
    }

    return false;
  }

  async cancel(): Promise<void> {
    this.context.stop();
  }

  async resume(): Promise<void> {
    this.context.resume();
  }

  async pause(): Promise<void> {
    this.context.pause();
  }

  async cleanup(): Promise<void> {
    try {
      await this.context.browserContext.cleanup();
    } catch (error) {
      logger.error(`Failed to cleanup browser context: ${error}`);
    }
  }

  async getCurrentTaskId(): Promise<string> {
    return this.context.taskId;
  }

  /**
   * Replays a saved history of actions with error handling and retry logic.
   *
   * @param history - The history to replay
   * @param maxRetries - Maximum number of retries per action
   * @param skipFailures - Whether to skip failed actions or stop execution
   * @param delayBetweenActions - Delay between actions in seconds
   * @returns List of action results
   */
  async replayHistory(
    history: AgentStepHistory,
    maxRetries = 3,
    skipFailures = true,
    delayBetweenActions = 2.0,
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    const replayLogger = createLogger('Executor:replayHistory');

    try {
      this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_START, this.context.taskId);

      for (let i = 0; i < history.history.length; i++) {
        const historyItem = history.history[i];

        // Parse the model output to get the goal and actions
        let goal = '';
        let parsedModelOutput: ParsedModelOutput | null = null;
        if (historyItem.modelOutput) {
          try {
            parsedModelOutput = JSON.parse(historyItem.modelOutput) as ParsedModelOutput;
            goal = parsedModelOutput?.current_state?.next_goal || '';
          } catch (error) {
            replayLogger.warning(`Step ${i + 1}: Could not parse modelOutput: ${error}`);
            // If modelOutput is crucial and unparseable, we might decide to skip or error differently.
            // For now, proceed, and the action check below will likely cause a skip.
          }
        }

        replayLogger.info(`Replaying step ${i + 1}/${history.history.length}: goal: ${goal}`);

        const actionsToReplay = parsedModelOutput?.action;

        // Skip steps with no actions, aligning with Python logic
        if (
          !historyItem.modelOutput || // No model output string at all
          !actionsToReplay || // 'action' field is missing or null after parsing
          (Array.isArray(actionsToReplay) && actionsToReplay.length === 0) || // 'action' is an empty array
          (Array.isArray(actionsToReplay) && actionsToReplay.length === 1 && actionsToReplay[0] === null) // 'action' is [null]
        ) {
          replayLogger.warning(`Step ${i + 1}: No action to replay based on modelOutput, skipping`);
          results.push(
            new ActionResult({
              error: 'No action to replay',
              includeInMemory: true,
            }),
          );
          continue;
        }

        // Try to execute the step with retries
        let retryCount = 0;
        let success = false;

        while (retryCount < maxRetries && !success) {
          try {
            // Check if execution should stop
            if (this.context.stopped) {
              replayLogger.info('Replay stopped by user');
              break;
            }

            // Execute the history step
            const stepResults = await this.navigator.executeHistoryStep(historyItem, delayBetweenActions * 1000);

            results.push(...stepResults);
            success = true;
          } catch (error) {
            retryCount++;
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (retryCount >= maxRetries) {
              const failMsg = `Step ${i + 1} failed after ${maxRetries} attempts: ${errorMessage}`;
              replayLogger.error(failMsg);

              results.push(
                new ActionResult({
                  error: failMsg,
                  includeInMemory: true,
                }),
              );

              if (!skipFailures) {
                throw new Error(failMsg);
              }
            } else {
              replayLogger.warning(`Step ${i + 1} failed (attempt ${retryCount}/${maxRetries}), retrying...`);
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, delayBetweenActions * 1000));
            }
          }
        }

        // If stopped during execution, break the loop
        if (this.context.stopped) {
          break;
        }
      }

      this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_OK, 'History replay completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      replayLogger.error(`History replay failed: ${errorMessage}`);
      this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_FAIL, `History replay failed: ${errorMessage}`);
    }

    return results;
  }
}
