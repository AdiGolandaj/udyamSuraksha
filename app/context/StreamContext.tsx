import { createContext, useContext } from "react";
import type { StreamChat } from "stream-chat";

type StreamContextValue = {
  client: StreamChat | null;
  streamToken: string | null;
};

const StreamContext = createContext<StreamContextValue>({
  client: null,
  streamToken: null,
});

export function StreamProvider({
  streamToken,
  children,
}: {
  streamToken: string | null;
  children: React.ReactNode;
}) {
  return (
    <StreamContext.Provider value={{ client: null, streamToken }}>
      {children}
    </StreamContext.Provider>
  );
}

export function useStreamContext() {
  return useContext(StreamContext);
}
