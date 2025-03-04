import { useState, useEffect } from 'react';
import { type GeneralSettingsConfig, generalSettingsStore, DEFAULT_GENERAL_SETTINGS } from '@extension/storage';

export const GeneralSettings = () => {
  const [settings, setSettings] = useState<GeneralSettingsConfig>(DEFAULT_GENERAL_SETTINGS);

  useEffect(() => {
    // Load initial settings
    generalSettingsStore.getSettings().then(setSettings);
  }, []);

  const updateSetting = async <K extends keyof GeneralSettingsConfig>(key: K, value: GeneralSettingsConfig[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await generalSettingsStore.updateSettings({ [key]: value });
  };

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100 text-left">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 text-left">General</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-700">Max Steps per Task</h3>
              <p className="text-sm font-normal text-gray-500">Step limit per task</p>
            </div>
            <input
              type="number"
              min="1"
              value={settings.maxSteps}
              onChange={e => updateSetting('maxSteps', Number.parseInt(e.target.value))}
              className="w-24 px-3 py-2 border rounded-md"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-700">Max Actions per Step</h3>
              <p className="text-sm font-normal text-gray-500">Action limit per step</p>
            </div>
            <input
              type="number"
              min="1"
              value={settings.maxActionsPerStep}
              onChange={e => updateSetting('maxActionsPerStep', Number.parseInt(e.target.value))}
              className="w-24 px-3 py-2 border rounded-md"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-700">Failure Tolerance</h3>
              <p className="text-sm font-normal text-gray-500">
                How many consecutive failures in a Task before stopping
              </p>
            </div>
            <input
              type="number"
              min="1"
              value={settings.maxFailures}
              onChange={e => updateSetting('maxFailures', Number.parseInt(e.target.value))}
              className="w-24 px-3 py-2 border rounded-md"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-700">Enable Vision</h3>
              <p className="text-sm font-normal text-gray-500">
                Use vision capabilities (Note: Vision uses more tokens)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.useVision}
                onChange={e => updateSetting('useVision', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-700">Enable Vision for Planner</h3>
              <p className="text-sm font-normal text-gray-500">Use vision in planner (Note: Vision uses more tokens)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.useVisionForPlanner}
                onChange={e => updateSetting('useVisionForPlanner', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-700">Replanning Frequency</h3>
              <p className="text-sm font-normal text-gray-500">Reconsider and update the plan every [Number] steps</p>
            </div>
            <input
              type="number"
              min="1"
              value={settings.planningInterval}
              onChange={e => updateSetting('planningInterval', Number.parseInt(e.target.value))}
              className="w-24 px-3 py-2 border rounded-md"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
