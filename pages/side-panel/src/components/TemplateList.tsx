/* eslint-disable react/prop-types */
interface Template {
  id: string;
  title: string;
  content: string;
}

interface TemplateListProps {
  templates: Template[];
  onTemplateSelect: (content: string) => void;
  isDarkMode?: boolean;
}

const TemplateList: React.FC<TemplateListProps> = ({ templates, onTemplateSelect, isDarkMode = false }) => {
  return (
    <div className="p-2">
      <h3 className={`mb-3 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Quick Start</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {templates.map(template => (
          <button
            type="button"
            key={template.id}
            onClick={() => onTemplateSelect(template.content)}
            className={`rounded-lg p-3 text-left transition-colors ${
              isDarkMode ? 'bg-slate-800 text-gray-200 hover:bg-slate-700' : 'bg-white text-gray-700 hover:bg-sky-50'
            } border ${isDarkMode ? 'border-slate-700' : 'border-sky-100'}`}>
            <div className="text-sm font-medium">{template.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TemplateList;
