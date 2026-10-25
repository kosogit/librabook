import React, { Suspense, lazy, useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  Compass,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  PanelLeftClose,
  Plus,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  UserRound,
  Users,
  Wallet,
  Armchair,
  X,
} from "lucide-react";
import { useStore } from "./store";
import { canAccess } from "./domain";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  SectionHeading,
  navigate,
  usePath,
} from "./components";
const Auth = lazy(() => import("./Auth"));
const Discovery = lazy(() => import("./Discovery"));
const LibraryDetail = lazy(() =>
  import("./Student").then((m) => ({ default: m.LibraryDetail })),
);
const Checkout = lazy(() =>
  import("./Student").then((m) => ({ default: m.Checkout })),
);
const MyBookings = lazy(() =>
  import("./Student").then((m) => ({ default: m.MyBookings })),
);
const staff = (name) =>
  lazy(() => import("./Staff").then((m) => ({ default: m[name] })));
const Dashboard = staff("Dashboard"),
  StaffBookings = staff("StaffBookings"),
  CheckIn = staff("CheckIn"),
  Seats = staff("Seats"),
  LibraryManagement = staff("LibraryManagement"),
  People = staff("People"),
  Payments = staff("Payments"),
  Moderation = staff("Moderation");
const navItems = {
  student: [
    ["home", "Your everyday", Home],
    ["explore", "Explore libraries", Compass],
    ["bookings", "My bookings", CalendarDays],
    ["saved", "Saved spaces", Heart],
    ["checkin", "Check in", QrCode],
  ],
  owner: [
    ["home", "Overview", LayoutDashboard],
    ["libraries", "My libraries", BookOpen],
    ["seats", "Seats & layout", Armchair],
    ["bookings", "Bookings", CalendarDays],
    ["walkin", "Walk-in booking", Plus],
    ["checkin", "Front desk", QrCode],
    ["students", "Students", Users],
    ["payments", "Payments", Wallet],
    ["reports", "Reports", ChartNoAxesCombined],
  ],
  receptionist: [
    ["home", "Today’s overview", LayoutDashboard],
    ["bookings", "Bookings", CalendarDays],
    ["checkin", "Check-in / out", QrCode],
    ["walkin", "Walk-in booking", Plus],
    ["seats", "Available seats", Armchair],
    ["students", "Students", Users],
  ],
  admin: [
    ["home", "Platform overview", LayoutDashboard],
    ["libraries", "Libraries", BookOpen],
    ["seats", "Seats & layout", Armchair],
    ["owners", "Library owners", Users],
    ["students", "Users", UserRound],
    ["bookings", "All bookings", CalendarDays],
    ["payments", "Payments & commission", Wallet],
    ["reports", "Analytics", ChartNoAxesCombined],
    ["complaints", "Complaints", MessageSquare],
    ["reviews", "Reviews", Star],
  ],
};
export default function App() {
  const path = usePath(),
    {
      db,
      session,
      loginDemo,
      logout,
      notify,
      loading,
      error,
      reload,
      live,
      activeLibrary,
      activeLibraryId,
      staffLibraries,
      setActiveLibraryId,
    } = useStore();
  const [menu, setMenu] = useState(false),
    [switcher, setSwitcher] = useState(false),
    [booking, setBooking] = useState(null),
    [help, setHelp] = useState(false);
  const parts = path.split("/").filter(Boolean),
    publicLibrary = ["library", "qr"].includes(parts[0]),
    role = publicLibrary ? "student" : session?.role || "student",
    section = parts[1] || "home";
  const unread = db.notifications.filter(
    (n) => n.userId === session?.id && !n.read,
  ).length;
  const suspended =
    session?.role === "student" &&
    db.members.some((m) => m.id === session.id && m.status === "Suspended");
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [path]);
  function onBook(libraryId, initialSeat = null, walkIn = false) {
    if (
      !db.libraries.some((l) => l.id === libraryId && l.status === "Approved")
    ) {
      notify("Select an approved library before creating a booking.", "error");
      return;
    }
    if (suspended) {
      notify(
        "Your account is suspended. Contact the library for help.",
        "error",
      );
      return;
    }
    setBooking({ libraryId, initialSeat, walkIn });
  }
  async function signout() {
    try {
      await logout();
      navigate("/auth/login");
      notify("You’ve been signed out.");
    } catch (e) {
      notify(e.message, "error");
    }
  }
  let content;
  if (parts[0] === "auth")
    return (
      <Suspense fallback={<Loading />}>
        <Auth key={section} mode={section} />
      </Suspense>
    );
  const protectedRoute =
    ["owner", "admin", "receptionist"].includes(parts[0]) ||
    (["profile", "notifications", "checkin"].includes(section) &&
      parts[0] === "student");
  if (protectedRoute && !session)
    content = (
      <Empty
        title="A little introduction first."
        text="Sign in to access your workspace."
        action={
          <Button onClick={() => navigate("/auth/login")}>
            Sign in <ArrowRight size={15} />
          </Button>
        }
      />
    );
  else if (!canAccess(session?.role || "student", path))
    content = (
      <Empty
        title="This space belongs to another role."
        text="Your current profile does not have access to this workspace."
        action={
          <Button onClick={() => navigate(`/${role}/home`)}>
            Back to your workspace
          </Button>
        }
      />
    );
  else if (suspended)
    content = (
      <Empty
        title="Your account is currently suspended."
        text="Please contact your library’s front desk for help with your account."
        action={<Button onClick={signout}>Sign out</Button>}
      />
    );
  else if (publicLibrary)
    content = (
      <LibraryDetail
        id={parts[1]}
        publicQr={parts[0] === "qr"}
        onBook={onBook}
      />
    );
  else if (section === "notifications") content = <Notifications />;
  else if (["profile", "settings"].includes(section)) content = <Profile />;
  else if (role === "student") {
    content =
      section === "bookings" ? (
        <MyBookings />
      ) : section === "checkin" ? (
        <CheckIn role={role} />
      ) : (
        <Discovery
          key={section}
          explore={section === "explore"}
          savedOnly={section === "saved"}
          budgetOnly={section === "budget"}
          offersOnly={section === "offers"}
        />
      );
  } else {
    content =
      section === "home" ? (
        <Dashboard role={role} onBook={onBook} />
      ) : section === "bookings" ? (
        <StaffBookings role={role} onBook={onBook} />
      ) : section === "checkin" ? (
        <CheckIn role={role} onBook={onBook} />
      ) : section === "seats" ? (
        <Seats role={role} onBook={onBook} />
      ) : section === "libraries" ? (
        <LibraryManagement role={role} />
      ) : section === "students" || section === "owners" ? (
        <People role={role} owners={section === "owners"} />
      ) : section === "payments" || section === "reports" ? (
        <Payments role={role} reports={section === "reports"} />
      ) : section === "complaints" || section === "reviews" ? (
        <Moderation reviews={section === "reviews"} />
      ) : section === "walkin" ? (
        <WalkIn onBook={onBook} />
      ) : (
        <Empty
          title="This page has turned."
          action={
            <Button onClick={() => navigate(`/${role}/home`)}>
              Go to overview
            </Button>
          }
        />
      );
  }
  return (
    <div
      className={`app-shell ${role === "student" ? "student-shell" : "staff-shell"} ${role === "student" && !publicLibrary && ["home", "explore", "saved", "budget", "offers"].includes(section) ? "discovery-screen" : ""}`}
    >
      <button
        className="skip-link"
        onClick={() => document.getElementById("main-content")?.focus()}
      >
        Skip to main content
      </button>
      {menu && (
        <button
          aria-label="Close navigation"
          className="mobile-backdrop"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a href={`#/${role}/home`} className="brand">
          <span className="brand-icon">
            <BookOpen size={23} />
          </span>
          <span>
            LibraBook<span className="brand-period">.</span>
          </span>
        </a>
        <span className="sidebar-caption">A LITTLE SPACE TO GROW</span>
        <div className="workspace-picker">
          <span className="workspace-icon">
            {role === "student" ? (
              <Sparkles size={17} />
            ) : (
              <BookOpen size={17} />
            )}
          </span>
          <div>
            <strong>
              {role === "student"
                ? "Your study space"
                : role === "admin"
                  ? "LibraBook platform"
                  : activeLibrary?.name || "Choose a library"}
            </strong>
            <span>
              {role === "student"
                ? "Make yourself at home"
                : `${role[0].toUpperCase() + role.slice(1)} workspace`}
            </span>
          </div>
        </div>
        {["owner", "receptionist"].includes(role) &&
          staffLibraries.length > 0 && (
            <label className="workspace-library-select">
              <span className="sr-only">Active library</span>
              <select
                aria-label="Active library"
                value={activeLibraryId}
                onChange={(e) => setActiveLibraryId(e.target.value)}
              >
                {staffLibraries.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        <span className="nav-label">
          {role === "student" ? "YOUR EVERYDAY" : "WORKSPACE"}
        </span>
        <nav aria-label="Main navigation">
          {navItems[role].map(([id, label, Icon]) => (
            <a
              key={id}
              aria-label={label}
              href={`#/${role}/${id}`}
              className={section === id && !publicLibrary ? "active" : ""}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "bookings" && (
                <small>
                  {db.bookings.filter((b) =>
                    role === "student"
                      ? b.userId === session?.id && b.status === "Upcoming"
                      : b.status === "Upcoming",
                  ).length || ""}
                </small>
              )}
              {section === id && !publicLibrary && (
                <span className="nav-active-dot" />
              )}
            </a>
          ))}
        </nav>
        <span className="nav-label secondary-label">A LITTLE EXTRA</span>
        <nav>
          <a
            href={`#/${role}/notifications`}
            className={section === "notifications" ? "active" : ""}
          >
            <Bell size={18} />
            <span>Notifications</span>
            {unread > 0 && <small>{unread}</small>}
          </a>
          <a
            href={`#/${role}/profile`}
            className={section === "profile" ? "active" : ""}
          >
            <UserRound size={18} />
            <span>
              {role === "student" ? "My profile" : "Account settings"}
            </span>
          </a>
          <button onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            <span>Help & support</span>
            <ArrowUpRight size={13} />
          </button>
        </nav>
        <div className="sidebar-bottom">
          {role === "student" ? (
            <div className="sidebar-message">
              <span className="book-doodle">
                <BookOpen size={31} strokeWidth={1} />
                <Sparkles size={16} />
              </span>
              <h3>
                Small steps.
                <br />
                Big possibilities.
              </h3>
              <p>
                Your next good study day
                <br />
                is just around the corner.
              </p>
              <a href="#/student/explore">
                Find your space <ArrowRight size={14} />
              </a>
            </div>
          ) : (
            <div className="sidebar-staff-note">
              <span className="status-dot" /> A good space starts with you.
            </div>
          )}
          <button
            className="sidebar-user"
            onClick={() =>
              session ? navigate(`/${role}/profile`) : navigate("/auth/login")
            }
          >
            <Avatar name={session?.name || "Welcome"} />
            <div>
              <strong>{session?.name || "Make yourself at home"}</strong>
              <span>
                {session
                  ? `${role[0].toUpperCase() + role.slice(1)} account`
                  : "Sign in to save your progress"}
              </span>
            </div>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            <span>
              {role === "student"
                ? "Your space to grow"
                : role === "admin"
                  ? "LibraBook platform"
                  : activeLibrary?.name || "Your workspace"}
            </span>
            <ChevronRightMini />
            <strong>
              {publicLibrary
                ? "Explore a space"
                : navItems[role].find((n) => n[0] === section)?.[1] ||
                  section[0].toUpperCase() + section.slice(1)}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="topbar-location">
              <MapPin size={14} /> Kanpur, India
            </span>
            {!live && (
              <button
                className="demo-switch"
                onClick={() => setSwitcher(!switcher)}
              >
                <span /> {role} demo <ChevronDown size={12} />
              </button>
            )}
            <button
              className="notification-button icon-btn"
              aria-label="View notifications"
              onClick={() => navigate(`/${role}/notifications`)}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </button>
            <span className="topbar-divider" />
            <button
              className="avatar-button"
              aria-label="View profile"
              onClick={() =>
                session ? navigate(`/${role}/profile`) : navigate("/auth/login")
              }
            >
              <Avatar name={session?.name || "Guest"} />
            </button>
          </div>
          {switcher && (
            <div className="role-menu">
              <span>EXPLORE A WORKSPACE</span>
              {Object.keys(navItems).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    navigate(loginDemo(r));
                    setSwitcher(false);
                    notify(`Welcome to the ${r} workspace.`);
                  }}
                >
                  <span>{r[0].toUpperCase() + r.slice(1)}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
              <p>
                Shared browser demo data.
                <br />
                No live payments or accounts.
              </p>
            </div>
          )}
        </header>
        <main className="main-content" id="main-content" tabIndex={-1}>
          <Suspense fallback={<Loading />}>
            {loading ? (
              <Loading />
            ) : error ? (
              <div className="error-panel">
                <h2>We couldn’t reach your workspace.</h2>
                <p>{error}</p>
                <Button onClick={reload}>Try again</Button>
              </div>
            ) : (
              content
            )}
          </Suspense>
          <footer>
            <span>
              <BookOpen size={13} /> Thoughtfully made for your next chapter.
            </span>
            <span>
              LibraBook © {new Date().getFullYear()} <i>·</i>
              <button onClick={() => setHelp(true)}>
                A little help? <ArrowUpRight size={11} />
              </button>
            </span>
          </footer>
        </main>
      </div>
      {role === "student" && (
        <nav className="student-bottom-dock" aria-label="Student navigation">
          <div className="student-bottom-tabs">
            {[
              ["home", "Explore", Compass],
              ["budget", "Under ₹40", Wallet],
              ["bookings", "Bookings", CalendarDays],
              ["saved", "Saved", Heart],
            ].map(([page, label, Icon]) => (
              <a
                key={page}
                href={`#/student/${page}`}
                className={section === page ? "active" : ""}
                aria-current={section === page ? "page" : undefined}
              >
                <Icon size={21} />
                <span>{label}</span>
              </a>
            ))}
          </div>
          <a
            className={`student-offers-tab student-scanner-tab ${section === "checkin" ? "active" : ""}`}
            href="#/student/checkin"
            aria-label="QR scanner"
            aria-current={section === "checkin" ? "page" : undefined}
          >
            <QrCode size={24} /> <span>Scan QR</span>
          </a>
        </nav>
      )}
      {booking && (
        <Suspense fallback={<Loading />}>
          <Checkout {...booking} onClose={() => setBooking(null)} />
        </Suspense>
      )}
      {help && (
        <Modal
          title="A little help goes a long way."
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            <h3>Finding your space</h3>
            <p>
              Explore libraries, choose a date and a green seat, then complete
              the checkout. Your booking QR is saved under My bookings.
            </p>
            <h3>At the front desk</h3>
            <p>
              Owners and receptionists can scan a booking code, welcome
              walk-ins, check students in or out, and extend a session if the
              next hour is free.
            </p>
            <h3>A note about this workspace</h3>
            <p>
              {live
                ? "Connected to your configured API."
                : "This is a browser-based demo. Data is shared across tabs on this device. OTP, payment, refund, and account actions are simulated."}
            </p>
            <a href="mailto:help@librabook.example" className="link">
              Contact your library’s front desk for real booking assistance.
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ChevronRightMini() {
  return <span className="breadcrumb-slash">/</span>;
}
export function Loading() {
  return (
    <div
      className="loading-screen"
      role="status"
      aria-label="Loading workspace"
    >
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-hero" />
      <div className="grid grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div className="skeleton skeleton-card" key={i} />
        ))}
      </div>
      <span className="sr-only">Loading your workspace…</span>
    </div>
  );
}
function WalkIn({ onBook }) {
  const { staffLibraries, activeLibraryId, setActiveLibraryId } = useStore();
  const choices = staffLibraries.filter((l) => l.status === "Approved");
  const libraryId = activeLibraryId,
    setLibraryId = setActiveLibraryId;
  return (
    <>
      <SectionHeading
        eyebrow="THERE’S ALWAYS ROOM FOR A NEW FACE"
        title="Welcome them into their next chapter."
        text="Choose a student, assign an available seat, and collect a cash or UPI payment."
      />
      <div className="walkin-intro panel">
        <div className="round-icon">
          <Plus size={30} />
        </div>
        <h2>A seat. A smile. A good start.</h2>
        <p>A quick walk-in booking gets your student settled in seconds.</p>
        <div className="walkin-steps">
          {[
            "Student details",
            "Choose a seat",
            "Duration & payment",
            "Ready to focus",
          ].map((x, i) => (
            <span key={x}>
              <i>{i + 1}</i>
              {x}
            </span>
          ))}
        </div>
        <div className="max-w-xs mx-auto mb-6 text-left">
          <Field label="Library">
            <select
              value={libraryId}
              onChange={(e) => setLibraryId(e.target.value)}
            >
              {choices.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button
          disabled={!choices.some((l) => l.id === libraryId)}
          onClick={() => onBook(libraryId, null, true)}
        >
          Start walk-in booking <ArrowRight size={16} />
        </Button>
      </div>
    </>
  );
}
function Notifications() {
  const { db, session, mutate, notify } = useStore();
  const mine = db.notifications.filter((n) => n.userId === session?.id);
  const [filter, setFilter] = useState("All");
  return (
    <>
      <SectionHeading
        eyebrow="STAY A LITTLE CONNECTED"
        title="Good to know."
        text="Booking updates, gentle reminders, and the little things that keep your day on track."
        action={
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await mutate(
                  (d) => ({
                    ...d,
                    notifications: d.notifications.map((n) =>
                      n.userId === session.id ? { ...n, read: true } : n,
                    ),
                  }),
                  { type: "notifications.readAll" },
                );
                notify("All caught up.");
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            Mark all as read
          </Button>
        }
      />
      <div className="tabs mb-6">
        {["All", "Unread"].map((t) => (
          <button
            key={t}
            className={filter === t ? "active" : ""}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <section className="panel notification-list">
        {mine
          .filter((n) => filter === "All" || !n.read)
          .map((n) => (
            <button
              className={`notification-item ${n.read ? "" : "unread"}`}
              key={n.id}
              onClick={async () => {
                try {
                  await mutate(
                    (d) => ({
                      ...d,
                      notifications: d.notifications.map((x) =>
                        x.id === n.id ? { ...x, read: true } : x,
                      ),
                    }),
                    { type: "notifications.read", payload: { id: n.id } },
                  );
                  navigate(`/${session.role}/bookings`);
                } catch (e) {
                  notify(e.message, "error");
                }
              }}
            >
              <span className="notification-symbol">
                {n.type === "reminder" ? (
                  <ClockMini />
                ) : (
                  <CalendarDays size={20} />
                )}
              </span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
              </div>
              {!n.read && <span className="unread-dot" />}
            </button>
          ))}
      </section>
      {!mine.filter((n) => filter === "All" || !n.read).length && (
        <Empty
          title="All quiet. All caught up."
          text="We’ll keep your booking updates right here."
        />
      )}
    </>
  );
}
function ClockMini() {
  return <Bell size={20} />;
}
function Profile() {
  const { session, setSession, saveItem, logout, notify, live, db } =
    useStore();
  const [busy, setBusy] = useState(false),
    [complaint, setComplaint] = useState(false);
  if (!session)
    return (
      <Empty
        title="Make yourself at home."
        action={
          <Button onClick={() => navigate("/auth/login")}>Sign in</Button>
        }
      />
    );
  return (
    <>
      <SectionHeading
        eyebrow="A LITTLE ABOUT YOU"
        title="Your own little corner."
        text="Keep your details up to date, and make this space yours."
      />
      <div className="profile-grid">
        <section className="panel p-7">
          <div className="profile-heading">
            <Avatar name={session.name} large />
            <div>
              <h2>{session.name}</h2>
              <p>{session.role} account</p>
            </div>
            <Badge status="Active" />
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.target);
              try {
                const updated = {
                  ...session,
                  name: f.get("name"),
                  email: f.get("email"),
                };
                if (live || session.role === "student")
                  await saveItem("members", {
                    ...db.members.find((m) => m.id === session.id),
                    id: session.id,
                    name: updated.name,
                    email: updated.email,
                    status: "Active",
                    membership:
                      db.members.find((m) => m.id === session.id)?.membership ||
                      "Hourly",
                  });
                setSession(updated);
                notify("Your profile is up to date.");
              } catch (e) {
                notify(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field
              label="Full name"
              name="name"
              defaultValue={session.name}
              required
            />
            <Field
              label="Email address"
              name="email"
              type="email"
              defaultValue={session.email}
              readOnly={live}
              required
            />
            <Button disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
          </form>
        </section>
        <aside className="panel p-7">
          <span className="round-icon">
            <ShieldCheck />
          </span>
          <h3 className="mt-5">Your workspace, your way.</h3>
          <p className="body-copy">
            {live
              ? "Your workspace is connected to the configured backend."
              : "You’re exploring a demo. Bookings and workspace changes are saved on this device."}
          </p>
          <div className="profile-actions">
            {!live && (
              <Button
                variant="secondary"
                onClick={() => navigate("/auth/forgot")}
              >
                Reset password <ArrowRight size={14} />
              </Button>
            )}
            <Button variant="secondary" onClick={() => setComplaint(true)}>
              Report an issue <MessageSquare size={14} />
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await logout();
                  navigate("/auth/login");
                } catch (e) {
                  notify(e.message, "error");
                }
              }}
            >
              Log out <LogOut size={14} />
            </Button>
          </div>
        </aside>
      </div>
      {complaint && (
        <Modal
          title="Let’s make it better."
          onClose={() => setComplaint(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              try {
                await saveItem("complaints", {
                  id: crypto.randomUUID(),
                  name: session.name,
                  libraryId: f.get("library"),
                  message: f.get("message"),
                  status: "Open",
                });
                setComplaint(false);
                notify("Your concern has been sent to the demo admin panel.");
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            <Field label="Library">
              <select name="library">
                {db.libraries.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="What can we help with?">
              <textarea name="message" required rows={4} maxLength={1000} />
            </Field>
            <Button>
              Submit concern <ArrowRight size={15} />
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
