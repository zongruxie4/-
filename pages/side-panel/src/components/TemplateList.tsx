/* eslint-disable react/prop-types */
interface Template {
  id: string;
  title: string;
  content: string;
}

interface TemplateListProps {
  templates: Template[];
  onTemplateSelect: (content: string) => void;
}

const TemplateList: React.FC<TemplateListProps> = ({ templates, onTemplateSelect }) => {
  return (
    <div className="w-full px-4 pt-2 pb-4">
      <h2 className="text-base font-semibold text-gray-700 mb-3 px-1">Quick Start</h2>
      {templates.length === 0 ? (
        <div className="p-4 text-gray-500 text-center backdrop-blur-sm bg-white/30 rounded-lg">
          No templates available
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(template => (
            <button
              key={template.id}
              onClick={() => onTemplateSelect(template.content)}
              onKeyDown={e => e.key === 'Enter' && onTemplateSelect(template.content)}
              className="w-full group backdrop-blur-sm bg-white/50 hover:bg-white/70 rounded-lg border border-sky-100 shadow-sm transition-all text-left"
              type="button">
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900">{template.title}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{template.content}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateList;
