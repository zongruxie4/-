/* eslint-disable react/prop-types */
import { FaTrash } from 'react-icons/fa';

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

interface ChatHistoryListProps {
  sessions: ChatSession[];
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  visible: boolean;
}

const ChatHistoryList: React.FC<ChatHistoryListProps> = ({ sessions, onSessionSelect, onSessionDelete, visible }) => {
  if (!visible) return null;

  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const deltaSeconds = Math.floor((now - timestamp) / 1000);

    // Less than 1 minute
    if (deltaSeconds < 60) {
      return `${deltaSeconds} seconds ago`;
    }

    // Less than 1 hour
    const deltaMinutes = Math.floor(deltaSeconds / 60);
    if (deltaMinutes < 60) {
      return `${deltaMinutes} ${deltaMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }

    // Less than 24 hours
    const deltaHours = Math.floor(deltaMinutes / 60);
    if (deltaHours < 24) {
      const remainingMinutes = deltaMinutes % 60;
      const hourText = `${deltaHours} ${deltaHours === 1 ? 'hour' : 'hours'}`;
      const minuteText =
        remainingMinutes > 0 ? ` ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}` : '';
      return `${hourText}${minuteText} ago`;
    }

    // More than 24 hours - use standard date format
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="h-full w-full overflow-y-auto p-4">
      {sessions.length === 0 ? (
        <div className="p-4 text-gray-500 text-center backdrop-blur-sm bg-white/30 rounded-lg">No chat history</div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <div
              key={session.id}
              className="group backdrop-blur-sm bg-white/50 hover:bg-white/70 rounded-lg border border-sky-100 shadow-sm transition-all">
              <div className="p-4 flex items-center">
                <button
                  type="button"
                  className="flex-1 min-w-0 cursor-pointer text-left"
                  onClick={() => onSessionSelect(session.id)}>
                  <p className="text-sm font-medium text-gray-900 truncate">{session.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(session.createdAt)}</p>
                </button>
                <button
                  type="button"
                  onClick={() => onSessionDelete(session.id)}
                  className="ml-3 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete chat session">
                  <FaTrash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatHistoryList;
