import { useUserContext } from "~/context/UserContext";

export function useUser() {
  const { user } = useUserContext();
  return user;
}
