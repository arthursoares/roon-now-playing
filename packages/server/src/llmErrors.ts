interface OutputLimitContext {
  reasoningEffort?: string;
  canLowerReasoning?: boolean;
}

export class OutputLimitError extends Error {
  constructor(maxOutputTokens: number, context?: OutputLimitContext) {
    const usesReasoningTokens = context?.reasoningEffort !== undefined
      && context.reasoningEffort !== 'none';
    const message = context === undefined
      ? `The model response reached the ${maxOutputTokens}-token output limit. Increase Maximum output tokens in Advanced Settings and try again.`
      : [
        `The model response reached the ${maxOutputTokens}-token output limit${usesReasoningTokens ? ', which includes reasoning tokens' : ''}.`,
        usesReasoningTokens && context.canLowerReasoning
          ? 'Lower Reasoning effort or increase Maximum output tokens in Advanced Settings and try again.'
          : 'Generate fewer or shorter facts, or increase Maximum output tokens in Advanced Settings and try again.',
      ].join(' ');
    super(
      message,
    );
    this.name = 'OutputLimitError';
  }
}
