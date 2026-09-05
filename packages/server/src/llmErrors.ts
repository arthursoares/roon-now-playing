export class OutputLimitError extends Error {
  constructor(maxOutputTokens: number) {
    super(
      `The model response reached the ${maxOutputTokens}-token output limit. Increase Maximum output tokens in Advanced Settings and try again.`,
    );
    this.name = 'OutputLimitError';
  }
}
