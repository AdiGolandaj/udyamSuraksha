import { useStreamContext } from "~/context/StreamContext";

export function useStreamClient() {
  return useStreamContext();
}
