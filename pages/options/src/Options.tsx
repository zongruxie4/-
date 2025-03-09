import { useState } from 'react';
import '@src/Options.css';
import { Button } from '@extension/ui';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { GeneralSettings } from './components/GeneralSettings';
import { ModelSettings } from './components/ModelSettings';
const Options = () => {
  const [activeTab, setActiveTab] = useState('models');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />;
      case 'models':
        return <ModelSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen min-w-[768px] flex bg-[url('/bg.jpg')] bg-cover bg-center text-gray-900">
      {/* Vertical Navigation Bar */}
      <nav className="w-48 border-r border-white/20 backdrop-blur-sm bg-[#0EA5E9]/10">
        <div className="p-4">
          <h1 className="text-xl font-bold mb-6 text-gray-800">Settings</h1>
          <ul className="space-y-2">
            {[
              { id: 'general', icon: '⚙️', label: 'General' },
              { id: 'models', icon: '📊', label: 'Models' },
            ].map(item => (
              <li key={item.id}>
                <Button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-4 py-2 rounded-lg flex items-center space-x-2 
                    ${
                      activeTab !== item.id
                        ? 'bg-[#0EA5E9]/15 backdrop-blur-sm font-medium text-gray-700 hover:text-white'
                        : 'backdrop-blur-sm text-white'
                    }`}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-8 backdrop-blur-sm bg-white/10">
        <div className="min-w-[512px] max-w-[1024px] mx-auto">{renderTabContent()}</div>
      </main>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <div>Loading...</div>), <div>Error Occurred</div>);
