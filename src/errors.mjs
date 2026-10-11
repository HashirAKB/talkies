/**
 * An expected failure with a message written for the person at the terminal.
 * The CLI prints these without a stack trace; anything else is a bug and keeps its stack.
 */
export class TalkiesError extends Error {
  /** @param {string} message  @param {{ hint?: string }} [options] */
  constructor(message, { hint } = {}) {
    super(message);
    this.name = 'TalkiesError';
    this.hint = hint;
  }
}
