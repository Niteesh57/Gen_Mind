import React, { createContext, useContext, type ReactNode } from 'react';
import { type IApiService, MockApiService, HttpApiService } from '../services/api';

const ApiContext = createContext<IApiService | null>(null);

interface ApiProviderProps {
  children: ReactNode;
  service?: IApiService;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children, service }) => {
  // Dependency injection: Resolve standard HTTP or mock service based on environment or manual overrides.
  const resolvedService = service || (
    import.meta.env.DEV 
      ? new MockApiService() 
      : new HttpApiService(import.meta.env.VITE_API_URL || '')
  );

  return (
    <ApiContext.Provider value={resolvedService}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApiService = (): IApiService => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApiService must be used within an ApiProvider');
  }
  return context;
};
