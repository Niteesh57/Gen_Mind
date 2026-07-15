import React from 'react';
import { EditorProvider, useEditor } from './context/EditorContext';
import { ProjectCreate } from './components/ProjectCreate/ProjectCreate';
import { EditorWorkspace } from './components/EditorWorkspace/EditorWorkspace';
import styles from './App.module.css';

const MainContent: React.FC = () => {
  const { project } = useEditor();

  if (!project) {
    return <ProjectCreate />;
  }

  return <EditorWorkspace />;
};

export const App: React.FC = () => {
  return (
    <EditorProvider>
      <div className={styles.appRoot}>
        <MainContent />
      </div>
    </EditorProvider>
  );
};

export default App;
