import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { makeSeed, roles } from "./data";
import { createBooking, changeBooking, refreshReminders } from "./domain";
import { api } from "./api";
import { normalizeWorkspace, assignedLibraries } from "./workspace";
const KEY = "librabook-v2";
const Context = createContext(null);
function read() {
  if (api.enabled)
    return Object.fromEntries(
      [
        "libraries",
        "seats",
        "members",
        "bookings",
        "holds",
        "notifications",
        "complaints",
        "reviews",
      ].map((k) => [k, []]),
    );
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    return normalizeWorkspace(
      stored?.libraries && stored?.holds ? stored : makeSeed(),
    );
  } catch {
    return normalizeWorkspace(makeSeed());
  }
}
export function Provider({ children }) {
  const [db, setDb] = useState(read),
    [session, setSession] = useState(() => {
      if (api.enabled) return null;
      try {
        return JSON.parse(sessionStorage.getItem("libra-session"));
      } catch {
        return null;
      }
    }),
    [toasts, setToasts] = useState([]),
    [loading, setLoading] = useState(api.enabled),
    [error, setError] = useState("");
  const ref = useRef(db);
  const startup = useRef(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState(
    () => sessionStorage.getItem("libra-active-library") || "studyhub",
  );
  const staffLibraries = assignedLibraries(db, session);
  const activeLibrary =
    staffLibraries.find((l) => l.id === selectedLibraryId) ||
    staffLibraries[0] ||
    null;
  const activeLibraryId = activeLibrary?.id || "";
  const setActiveLibraryId = (id) => {
    if (!staffLibraries.some((l) => l.id === id)) return;
    sessionStorage.setItem("libra-active-library", id);
    setSelectedLibraryId(id);
  };
  ref.current = db;
  const notify = (message, type = "success", key = null) => {
    const id = crypto.randomUUID();
    setToasts((t) => [
      ...t.filter((toast) => !key || toast.key !== key),
      { id, message, type, key },
    ]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  };
  function persist(next) {
    next = normalizeWorkspace(next);
    if (!api.enabled) localStorage.setItem(KEY, JSON.stringify(next));
    ref.current = next;
    setDb(next);
  }
  const reload = async (quiet = false) => {
    if (!api.enabled) return;
    if (!quiet) setLoading(true);
    try {
      const next = await api.snapshot();
      persist(next);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  };
  useEffect(() => {
    if (!api.enabled && !localStorage.getItem(KEY)) persist(db);
    if (api.enabled) {
      let cancelled = false,
        unsubscribe;
      startup.current ||= api.session();
      startup.current
        .then(async (user) => {
          if (cancelled) return;
          setSession(user);
          await reload();
          if (!cancelled)
            unsubscribe = api.subscribe(
              () => reload(true),
              () => {},
            );
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e.message);
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    }
    const listen = (e) => {
      if (e.key === KEY) {
        setDb(read());
        notify("Workspace updated in another tab.", "info");
      }
    };
    window.addEventListener("storage", listen);
    return () => window.removeEventListener("storage", listen);
  }, []);
  useEffect(() => {
    sessionStorage.setItem("libra-session", JSON.stringify(session));
  }, [session]);
  useEffect(() => {
    if (api.enabled) return;
    const timer = setInterval(() => {
      const run = () => {
        const current = read();
        const next = refreshReminders(current);
        if (next !== current) persist(next);
      };
      if (navigator.locks)
        navigator.locks.request("librabook-write", run).catch(() => {});
      else run();
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  const mutate = async (fn, command) => {
    if (api.enabled) {
      if (!command) throw new Error("This action needs a backend command.");
      const next = await api.command(command);
      persist(next);
      return next;
    }
    const run = () => {
      const next = fn(read());
      persist(next);
      return next;
    };
    return navigator.locks
      ? navigator.locks.request("librabook-write", run)
      : run();
  };
  const loginDemo = (role) => {
    if (api.enabled) throw new Error("Demo roles are disabled in live mode.");
    setSession({ ...roles[role], role });
    return `/${role}/home`;
  };
  const logout = async () => {
    if (api.enabled) await api.auth("logout");
    setSession(null);
    if (api.enabled) await reload();
  };
  const book = (input) =>
    mutate((d) => createBooking(d, input), {
      type: "booking.create",
      payload: input,
    });
  const updateBooking = (id, action) =>
    mutate(
      (d) => {
        const guestIds = JSON.parse(
          localStorage.getItem("libra-guest-bookings") || "[]",
        );
        const actor =
          session ||
          (guestIds.includes(id)
            ? {
                id: d.bookings.find((b) => b.id === id)?.userId,
                role: "student",
              }
            : null);
        return changeBooking(d, id, action, actor);
      },
      {
        type: `booking.${action}`,
        payload: { id },
      },
    );
  const saveItem = (collection, item) =>
    mutate(
      (d) => ({
        ...d,
        [collection]: d[collection].some((x) => x.id === item.id)
          ? d[collection].map((x) => (x.id === item.id ? { ...x, ...item } : x))
          : [item, ...d[collection]],
      }),
      { type: `${collection}.save`, payload: item },
    );
  const removeItem = (collection, id) =>
    mutate(
      (d) => ({ ...d, [collection]: d[collection].filter((x) => x.id !== id) }),
      { type: `${collection}.delete`, payload: { id } },
    );
  return (
    <Context.Provider
      value={{
        db,
        session,
        setSession,
        loginDemo,
        logout,
        mutate,
        book,
        updateBooking,
        saveItem,
        removeItem,
        notify,
        loading,
        error,
        reload,
        live: api.enabled,
        staffLibraries,
        activeLibrary,
        activeLibraryId,
        setActiveLibraryId,
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "error" ? "!" : "✓"} <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
