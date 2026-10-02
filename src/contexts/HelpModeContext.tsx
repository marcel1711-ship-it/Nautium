import React, { createContext, useContext, useState, useEffect } from 'react';

interface HelpModeContextType {
  helpMode: boolean;
  toggleHelpMode: () => void;
}

const HelpModeContext = createContext<HelpModeContextType>({ helpMode: false, toggleHelpMode: () => {} });

export const useHelpMode = () => useContext(HelpModeContext);

export const HelpModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [helpMode, setHelpMode] = useState(() => {
    try { return localStorage.getItem('nautium_help_mode') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('nautium_help_mode', String(helpMode)); } catch {}
  }, [helpMode]);

  const toggleHelpMode = () => setHelpMode(prev => !prev);

  return (
    <HelpModeContext.Provider value={{ helpMode, toggleHelpMode }}>
      {children}
    </HelpModeContext.Provider>
  );
};
