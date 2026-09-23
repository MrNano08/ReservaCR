import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "../types";
import { api, send, ApiError } from "../services/api";
interface Auth {
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (body: unknown) => Promise<User>;
  logout: () => Promise<void>;
}
const Context = createContext<Auth>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function refresh() {
    setError("");
    try {
      setUser(await api("/auth/me"));
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        setError((e as Error).message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  const value: Auth = {
    user,
    loading,
    error,
    refresh,
    login: async (email, password) => {
      const u = await api<User>(
        "/auth/login",
        send("POST", { email, password }),
      );
      setUser(u);
      return u;
    },
    register: async (body) => {
      const u = await api<User>("/auth/register", send("POST", body));
      setUser(u);
      return u;
    },
    logout: async () => {
      await api("/auth/logout", send("POST"));
      setUser(null);
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
