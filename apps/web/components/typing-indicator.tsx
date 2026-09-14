'use client';

export function TypingIndicator({ text }: { text: string }) {
  return (
    <div className="typing-indicator" role="status">
      <span className="typing-wave-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="typing-indicator-text">{text}</span>
    </div>
  );
}
