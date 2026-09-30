import { useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { authStorage } from "@/storage/authStorage";

interface UseSignalRReturn<T> {
  connection: signalR.HubConnection | null;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (method: string, ...args: any[]) => Promise<void>;
}

export function useSignalR<T = any>(
  hubUrl: string,
  onConnected?: (connectionId: string) => void,
  onDisconnected?: () => void,
  enabled: boolean = true 
): UseSignalRReturn<T> {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(
    null
  );
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(async () => {
    let activeConnection: signalR.HubConnection | null = null;

    try {
      const token = authStorage.getToken();
      const hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => {
            return token || "";
          },
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            if (retryContext.elapsedMilliseconds < 60000) {
              return 3000;
            } else if (retryContext.elapsedMilliseconds < 300000) {
              return 10000;
            } else {
              return 30000;
            }
          },
        })
        .configureLogging(signalR.LogLevel.Information) 
        .withServerTimeout(60000)
        .build();
      activeConnection = hubConnection;
      const isActiveConnection = () =>
        mountedRef.current && connectionRef.current === hubConnection;

      hubConnection.onclose((error) => {
        if (isActiveConnection()) {
          setIsConnected(false);
          setError(error ? "Connection closed with error" : null);

          if (onDisconnected) {
            onDisconnected();
          }
        }
      });

      hubConnection.onreconnecting((error) => {
        if (isActiveConnection()) {
          setIsConnected(false);
          setError("Reconnecting...");
        }
      });

      hubConnection.onreconnected((connectionId) => {
        if (isActiveConnection()) {
          setIsConnected(true);
          setError(null);
        }
      });

      connectionRef.current = hubConnection;
      await hubConnection.start();
      
      if (!mountedRef.current || connectionRef.current !== hubConnection) {
        await hubConnection.stop();
        return;
      }

      setConnection(hubConnection);
      setIsConnected(true);
      setError(null);

      if (onConnected) {
        onConnected(hubConnection.connectionId!);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error';
      if (
        mountedRef.current &&
        (!activeConnection || connectionRef.current === activeConnection)
      ) {
        setError(errorMessage);
        setIsConnected(false);
      }
    }
  }, [hubUrl, onConnected, onDisconnected]);

  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.stop();
      setConnection(null);
      connectionRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (method: string, ...args: any[]) => {
      if (connectionRef.current && isConnected) {
        try {
          await connectionRef.current.invoke(method, ...args);
        } catch (err: any) {
          console.error("Error sending message:", err);
          throw err;
        }
      } else {
        throw new Error("Connection not established");
      }
    },
    [isConnected]
  );

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connect();
    } else {
      if (connectionRef.current) {
        connectionRef.current.stop().then(() => {
        });
        if (mountedRef.current) {
          setConnection(null);
          setIsConnected(false);
        }
        connectionRef.current = null;
      }
    }

    return () => {
      const activeConnection = connectionRef.current;
      connectionRef.current = null;
      if (activeConnection) {
        activeConnection.stop();
      }
    };
  }, [hubUrl, enabled]); 

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    connection,
    isConnected,
    error,
    connect,
    disconnect,
    sendMessage,
  };
}