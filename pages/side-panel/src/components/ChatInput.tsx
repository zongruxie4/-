import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onStopTask: () => void;
  disabled: boolean;
  showStopButton: boolean;
  setContent?: (setter: (text: string) => void) => void;
}

export default function ChatInput({ onSendMessage, onStopTask, disabled, showStopButton, setContent }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle text changes and resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    // Resize textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  };

  // Expose a method to set content from outside
  useEffect(() => {
    if (setContent) {
      setContent(setText);
    }
  }, [setContent]);

  // Initial resize when component mounts
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (text.trim()) {
        onSendMessage(text);
        setText('');
      }
    },
    [text, onSendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="border rounded-lg overflow-hidden hover:border-sky-400 focus-within:border-sky-400 transition-colors"
      aria-label="Chat input form">
      <div className="flex flex-col">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={4}
          className={`w-full p-3 resize-none border-none focus:outline-none ${
            disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'
          }`}
          placeholder="What can I help with?"
          aria-label="Message input"
        />

        <div className={`flex items-center justify-between px-3 py-1.5 ${disabled ? 'bg-gray-100' : 'bg-white'}`}>
          <div className="flex gap-2 text-gray-500">{/* Icons can go here */}</div>

          {showStopButton ? (
            <button
              type="button"
              onClick={onStopTask}
              className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled}
              className="px-3 py-1 bg-[#19C2FF] text-white rounded-md hover:bg-[#0073DC] transition-colors disabled:opacity-50">
              Send
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
