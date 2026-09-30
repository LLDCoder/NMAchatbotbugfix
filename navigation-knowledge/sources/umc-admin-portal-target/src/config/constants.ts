export const TIME = {
  TOKEN_EXPIRE: 2 * 60 * 60 * 1000,      
  REFRESH_TOKEN_EXPIRE: 7 * 24 * 60 * 60 * 1000, 
  TOKEN_REFRESH_AHEAD: 5 * 60 * 1000,    
  DEBOUNCE_WAIT: 300,                    
  THROTTLE_WAIT: 500                    
} as const;


export default {
  TIME,
}; 