// Файл: www/js/types/app-contracts.js

/**
 * @typedef {"STOPPED" | "READY" | "WORK" | "REST"} TabataStatus
 */

/**
 * @typedef {Object} RingController
 * @property {() => void} start
 * @property {() => void} stop
 * @property {(offset: number) => void} setTarget
 * @property {(offset: number) => void} snap
 * @property {(alpha: number) => void} setAlpha
 * @property {() => number} getVisual
 */

/**
 * @typedef {Object} CountdownEngine
 * @property {(durationMs: number) => {status: string, totalMs: number, remainingMs: number, targetEpochMs: number}} start
 * @property {() => {status: string, totalMs: number, remainingMs: number, targetEpochMs: number}} pause
 * @property {() => {status: string, totalMs: number, remainingMs: number, targetEpochMs: number}} resume
 * @property {() => {status: string, totalMs: number, remainingMs: number, targetEpochMs: number}} stop
 * @property {(deltaMs: number) => {status: string, totalMs: number, remainingMs: number, targetEpochMs: number}} adjust
 * @property {(workerRemainingMs: number) => {status: string, totalMs: number, remainingMs: number, targetEpochMs: number, rebased: boolean}} rebaseFromWorker
 * @property {(ms: number) => {status: string, totalMs: number, remainingMs: number, targetEpochMs: number}} setPausedRemaining
 * @property {() => number} getRemaining
 * @property {() => string} getStatus
 * @property {(extra?: Object) => {status: string, totalMs: number, remainingMs: number, targetEpochMs: number}} snapshot
 */

/**
 * @typedef {Object} StopwatchEngine
 * @property {(fromElapsedMs?: number) => {status: string, running: boolean, startEpochMs: number, elapsedMs: number}} start
 * @property {() => {status: string, running: boolean, startEpochMs: number, elapsedMs: number}} pause
 * @property {() => {status: string, running: boolean, startEpochMs: number, elapsedMs: number}} reset
 * @property {(nextElapsedMs: number) => {status: string, running: boolean, startEpochMs: number, elapsedMs: number}} setElapsed
 * @property {() => number} getElapsed
 * @property {() => boolean} isRunning
 * @property {(extra?: Object) => {status: string, running: boolean, startEpochMs: number, elapsedMs: number}} snapshot
 */

/**
 * @typedef {Object} TabataEngine
 * @property {(opts?: {workMs?: number, restMs?: number, rounds?: number, readyMs?: number}) => Object} configure
 * @property {() => {status: TabataStatus, currentRound: number, phaseDuration: number, phaseEndTime: number}} startReady
 * @property {() => {status: TabataStatus, currentRound: number, phaseDuration: number, phaseEndTime: number}} stop
 * @property {() => number} pause
 * @property {(remainingMs: number) => {status: TabataStatus, currentRound: number, phaseDuration: number, phaseEndTime: number}} resume
 * @property {() => number} getRemaining
 * @property {() => number} getPhaseDuration
 * @property {(deltaMs: number) => {status: TabataStatus, currentRound: number, phaseDuration: number, phaseEndTime: number}} shortenCurrentPhase
 * @property {() => {completed: boolean, snapshot: {status: TabataStatus, currentRound: number, phaseDuration: number, phaseEndTime: number}}} advanceOnce
 * @property {(extra?: Object) => {status: TabataStatus, currentRound: number, phaseDuration: number, phaseEndTime: number}} snapshot
 */

/**
 * @typedef {Object} TimerModule
 * @property {boolean} isRunning
 * @property {boolean} isPaused
 * @property {boolean} isFinished
 * @property {number} totalDuration
 * @property {number} initialDurationMs
 * @property {number} timeRemainingMs
 * @property {number} targetEpochMs
 * @property {number} remainingAtPause
 * @property {number} ringLength
 * @property {RingController | null} ringCtrl
 * @property {CountdownEngine | null} countdownEngine
 * @property {() => void} init
 * @property {() => Promise<void>} toggle
 * @property {() => Promise<void>} restart
 * @property {(clearInputs?: boolean) => Promise<void>} reset
 * @property {() => number} getRemainingTime
 * @property {() => void} updateUIState
 * @property {(rem: number) => void} updateDisplay
 * @property {() => void} updateAdjustButtons
 * @property {() => void} startUiLoop
 * @property {() => void} stopUiLoop
 * @property {() => void} finishAsCompleted
 */

/**
 * @typedef {Object} StopwatchModule
 * @property {boolean} isRunning
 * @property {number} elapsedTime
 * @property {number} startEpochMs
 * @property {number} pauseTime
 * @property {number} ringLength
 * @property {RingController | null} ringCtrl
 * @property {StopwatchEngine | null} stopwatchEngine
 * @property {{total: number, diff: number, index: number}[]} laps
 * @property {{id: number, name: string, date: number, totalTime: number, laps: Array<{total: number, diff: number, index: number}>}[]} savedSessions
 * @property {() => void} init
 * @property {() => void} toggle
 * @property {(isBackground?: boolean) => void} tick
 * @property {() => void} recordLapOrReset
 * @property {() => void} updateDisplay
 * @property {() => void} updateSaveButtonVisibility
 * @property {() => void} reRenderCurrentLaps
 * @property {(lap: {total: number, diff: number, index: number}, isLatest?: boolean) => HTMLElement} createLapElement
 */

/**
 * @typedef {Object} TabataModule
 * @property {TabataStatus} status
 * @property {boolean} paused
 * @property {boolean} completionHandled
 * @property {number} work
 * @property {number} rest
 * @property {number} rounds
 * @property {number} currentRound
 * @property {number} phaseDuration
 * @property {number} phaseEndTime
 * @property {number} remainingAtPause
 * @property {number} ringLength
 * @property {RingController | null} ringCtrl
 * @property {TabataEngine | null} tabataEngine
 * @property {() => void} init
 * @property {() => void} toggle
 * @property {() => void} start
 * @property {() => void} pause
 * @property {() => void} resume
 * @property {(opts?: {resetRing?: boolean, silent?: boolean}) => void} stop
 * @property {(isBackground?: boolean) => void} tick
 * @property {(missedTime?: number) => void} nextPhase
 * @property {() => "ok" | "complete"} advancePhase
 * @property {() => void} updatePhaseStyles
 * @property {(rem: number) => void} render
 */
