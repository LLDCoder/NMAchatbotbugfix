export const SIGNALR_CONFIG = {
  get HUB_URL() {
    return import.meta.env.VITE_SIGNALR_HUB_URL || '/chathub';
  },
  
  RECONNECT: {
    FAST_RETRY_INTERVAL: 3000,      
    MEDIUM_RETRY_INTERVAL: 10000,   
    SLOW_RETRY_INTERVAL: 30000,     
    FAST_RETRY_DURATION: 60000,    
    MEDIUM_RETRY_DURATION: 300000,  
  },
  
  SERVER_TIMEOUT: 60000,
  
  LOG_LEVEL: 'Warning' as const,
  
  EVENTS: {
    RECEIVE_NOTIFICATION: 'ReceiveMessage',
    NEW_MESSAGE: 'NewMessage',
  },
};
