import React, { useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Armchair,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  IndianRupee,
  Layers3,
  MapPin,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useStore } from "./store";
import { localDate, libraryPhotos } from "./data";
import { addLibrary } from "./workspace";
import { endTime, money, seatState, timeLabel } from "./domain";
import {
  Avatar,
  Badge,
  BookingDetails,
  Button,
  Empty,
  Field,
  Modal,
  QR,
  Scanner,
  SeatMap,
  SectionHeading,
  downloadBlob,
  navigate,
} from "./components";
export function Dashboard({ role, onBook }) {
  const { db, session, activeLibraryId, activeLibrary } = useStore();
  const admin = role === "admin",
    lib = db.libraries.find((l) => l.id === activeLibraryId),
    all = admin
      ? db.bookings
      : db.bookings.filter((b) => b.libraryId === activeLibraryId),
    today = all.filter((b) => b.date === localDate()),
    revenue = today
      .filter((b) => b.payment === "Paid")
      .reduce((sum, b) => sum + b.amount, 0),
    active = today.filter((b) => b.status === "Active").length,
    available = db.seats.filter(
      (s) =>
        (admin || s.libraryId === activeLibraryId) &&
        seatState(s, db, { date: localDate(), start: "10:00", duration: 2 }) ===
          "Available",
    ).length;
  return (
    <>
      <SectionHeading
        eyebrow={
          admin
            ? "THE BIG PICTURE"
            : role === "receptionist"
              ? "A WARM WELCOME STARTS HERE"
              : "YOUR LIBRARY, AT A GLANCE"
        }
        title={
          admin
            ? "Good spaces. Growing together."
            : `Good morning, ${session?.name.split(" ")[0] || "there"}.`
        }
        text={
          admin
            ? "A thoughtful overview of the LibraBook community."
            : "Here’s what’s happening at StudyHub Library today."
        }
        action={
          <Button
            onClick={() =>
              admin
                ? navigate("/admin/libraries")
                : onBook(activeLibraryId, null, true)
            }
          >
            <Plus size={16} />
            {admin ? "Manage libraries" : "Walk-in booking"}
          </Button>
        }
      />
      <div className="stat-grid">
        {[
          [
            admin ? "Total libraries" : "Today’s bookings",
            admin ? db.libraries.length : today.length,
            CalendarDays,
            "sage",
            admin ? "Across the platform" : "A new day of possibilities",
          ],
          [
            admin ? "Community members" : "Available seats",
            admin ? db.members.length : available,
            admin ? Users : Armchair,
            "blue",
            admin ? "Learning, every day" : "Ready for a little focus",
          ],
          [
            "Revenue today",
            money(revenue),
            Wallet,
            "sand",
            "Completed demo payments",
          ],
          [
            admin ? "Pending approvals" : "Occupied seats",
            admin
              ? db.libraries.filter((l) => l.status === "Pending").length
              : active,
            admin ? ShieldCheck : Users,
            "rose",
            admin ? "Awaiting your review" : "Students in their element",
          ],
        ].map(([label, value, Icon, color, note]) => (
          <article className="stat-card" key={label}>
            <div>
              <span>{label}</span>
              <i className={color}>
                <Icon size={20} />
              </i>
            </div>
            <strong>{value}</strong>
            <p>{note}</p>
          </article>
        ))}
      </div>
      <div className="dashboard-mid">
        <section className="panel">
          <SectionHeading
            title="A little progress, every day"
            text="Booking revenue · last 7 days"
            action={
              <span className="chart-key">
                <i /> Revenue
              </span>
            }
          />
          <RevenueChart bookings={all} />
        </section>
        <section className="panel occupancy-panel">
          <SectionHeading
            title={admin ? "Community snapshot" : "Space to focus"}
            text={
              admin
                ? "People behind the possibilities"
                : "Today’s seat occupancy"
            }
          />
          <div className="occupancy-center">
            <div
              className="donut"
              style={{
                "--occupied": `${admin ? 75 : Math.round((active / Math.max(1, db.seats.filter((s) => s.libraryId === activeLibraryId).length)) * 100)}%`,
              }}
            >
              <div>
                <strong>{admin ? db.members.length : active}</strong>
                <span>{admin ? "students" : "occupied"}</span>
              </div>
            </div>
            <div className="donut-legend">
              <span>
                <i className="green-dot" />
                {admin ? "Active students" : "Available seats"}
                <b>
                  {admin
                    ? db.members.filter((m) => m.status === "Active").length
                    : available}
                </b>
              </span>
              <span>
                <i className="blue-dot" />
                {admin ? "Libraries" : "Upcoming bookings"}
                <b>
                  {admin
                    ? db.libraries.length
                    : today.filter((b) => b.status === "Upcoming").length}
                </b>
              </span>
              <span>
                <i className="sand-dot" />
                {admin ? "Pending libraries" : "Protected seats"}
                <b>
                  {admin
                    ? db.libraries.filter((l) => l.status === "Pending").length
                    : db.seats.filter(
                        (s) =>
                          s.libraryId === activeLibraryId &&
                          s.status === "Protected",
                      ).length}
                </b>
              </span>
            </div>
          </div>
          <div className="panel-foot">
            <Clock size={13} /> Every good study day starts with a little space.
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <SectionHeading
            title="Recent bookings"
            text="Good people. Productive hours."
            action={
              <button
                className="link"
                onClick={() => navigate(`/${role}/bookings`)}
              >
                View all <ArrowRight size={14} />
              </button>
            }
          />
          <BookingTable items={all.slice(0, 5)} />
        </section>
        <section className="panel">
          <SectionHeading
            title={admin ? "Libraries to review" : "At the front desk"}
            text={
              admin
                ? "Give the next great space a warm welcome."
                : "Make their day a little easier."
            }
          />
          {admin ? (
            db.libraries
              .filter((l) => l.status === "Pending")
              .map((l) => (
                <div className="mini-library" key={l.id}>
                  <img src={l.photo} alt={l.name} />
                  <div>
                    <b>{l.name}</b>
                    <p>{l.address}</p>
                  </div>
                  <button
                    className="circle-button"
                    onClick={() => navigate("/admin/libraries")}
                    aria-label="Review library"
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </div>
              ))
          ) : (
            <>
              <div className="quick-actions">
                <button onClick={() => navigate(`/${role}/checkin`)}>
                  <QrCode />
                  <strong>Quick check-in</strong>
                  <span>
                    Scan a QR or enter a code <ArrowRight size={13} />
                  </span>
                </button>
                <button onClick={() => onBook(activeLibraryId, null, true)}>
                  <Plus />
                  <strong>Welcome a walk-in</strong>
                  <span>
                    Find their perfect seat <ArrowRight size={13} />
                  </span>
                </button>
              </div>
              <div className="staff-note">
                <BookOpen size={26} />
                <p>
                  Small moments of care.
                  <br />
                  <b>A better place to learn.</b>
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
export function RevenueChart({ bookings }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return {
      date: localDate(d),
      label: d.toLocaleDateString("en", { weekday: "short" }),
    };
  });
  const values = days.map((d) =>
    bookings
      .filter((b) => b.date === d.date && b.payment === "Paid")
      .reduce((sum, b) => sum + b.amount, 0),
  );
  const max = Math.max(...values, 100);
  return (
    <div className="revenue-chart">
      <div className="chart-number">
        {money(values.reduce((a, b) => a + b, 0))}
        <small>across the last seven days</small>
      </div>
      <div className="bar-chart">
        {days.map((d, i) => (
          <div className="chart-column" key={d.date}>
            <span>{money(values[i])}</span>
            <div className="bar-track">
              <div
                className="bar"
                style={{ height: `${Math.max(2, (values[i] / max) * 100)}%` }}
                title={`${d.date}: ${money(values[i])}`}
              />
            </div>
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
export function BookingTable({ items }) {
  const { db } = useStore(),
    [detail, setDetail] = useState(null);
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>STUDENT</th>
              <th>SEAT</th>
              <th>SESSION</th>
              <th>STATUS</th>
              <th>AMOUNT</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td>
                  <div className="person-cell">
                    <Avatar name={b.name} />
                    <div>
                      <strong>{b.name}</strong>
                      <small>{b.id}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="seat-label">
                    {db.seats.find((s) => s.id === b.seatId)?.label || "—"}
                  </span>
                </td>
                <td>
                  <div className="text-xs">
                    {timeLabel(b.start)}
                    <small className="block text-muted mt-1">
                      {b.date} · {b.duration}h
                    </small>
                  </div>
                </td>
                <td>
                  <Badge status={b.status} />
                </td>
                <td className="font-semibold">{money(b.amount)}</td>
                <td>
                  <button
                    className="icon-btn"
                    aria-label={`View booking ${b.id}`}
                    onClick={() => setDetail(b)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && (
        <Empty
          title="No bookings found."
          text="Try a different date or search term."
        />
      )}
      {detail && (
        <BookingDetails booking={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
export function StaffBookings({ role, onBook }) {
  const { db, activeLibraryId } = useStore();
  const [status, setStatus] = useState("All bookings"),
    [search, setSearch] = useState(""),
    [date, setDate] = useState("");
  const items = db.bookings.filter(
    (b) =>
      (role === "admin" || b.libraryId === activeLibraryId) &&
      (status === "All bookings" || b.status === status) &&
      (!date || b.date === date) &&
      `${b.name} ${b.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <SectionHeading
        eyebrow="EVERY SESSION COUNTS"
        title="Room for everyone."
        text="Manage bookings, welcome students, and keep things flowing."
        action={
          role !== "admin" && (
            <Button onClick={() => onBook(activeLibraryId, null, true)}>
              <Plus size={16} /> New booking
            </Button>
          )
        }
      />
      <div className="panel">
        <div className="table-toolbar">
          <div className="tabs">
            {[
              "All bookings",
              "Pending payment",
              "Payment review",
              "Rejected",
              "Upcoming",
              "Active",
              "Completed",
              "Cancelled",
            ].map((t) => (
              <button
                key={t}
                className={status === t ? "active" : ""}
                onClick={() => setStatus(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="search-input">
              <Search size={15} />
              <input
                aria-label="Search bookings"
                placeholder="Name or booking ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <input
              aria-label="Filter booking date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <BookingTable items={items} />
        <div className="panel-foot">
          {items.length} bookings shown{" "}
          <button
            className="link ml-auto"
            onClick={() => {
              setSearch("");
              setDate("");
              setStatus("All bookings");
            }}
          >
            Clear filters
          </button>
        </div>
      </div>
    </>
  );
}
export function CheckIn({ role, onBook }) {
  const { db, session, notify, activeLibraryId } = useStore(),
    [code, setCode] = useState(""),
    [found, setFound] = useState(null),
    [error, setError] = useState("");
  function lookup(value = code) {
    const b = db.bookings.find(
      (b) =>
        b.id.toUpperCase() === value.trim().toUpperCase() &&
        (role === "student"
          ? b.userId === session?.id
          : b.libraryId === activeLibraryId),
    );
    if (!b) {
      setError("No matching booking found. Check the code and try again.");
      return;
    }
    setCode(value);
    setError("");
    setFound(b);
  }
  return (
    <>
      <SectionHeading
        eyebrow="LESS WAITING. MORE LEARNING."
        title={
          role === "student"
            ? "Settle in. Make yourself at home."
            : "A warm welcome, every time."
        }
        text="Scan a booking QR or enter the code to check in, check out, or extend a session."
      />
      <div className="checkin-grid">
        <section className="panel">
          <SectionHeading
            title="Scan a booking QR"
            text="A quick scan, and they’re on their way."
          />
          <Scanner onCode={lookup} />
          <form
            className="p-6"
            onSubmit={(e) => {
              e.preventDefault();
              lookup();
            }}
          >
            <Field label="Or enter the booking code">
              <div className="flex gap-2">
                <input
                  placeholder="e.g. LB-20261001"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
                <Button>
                  Find booking <ArrowRight size={15} />
                </Button>
              </div>
            </Field>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>
        <section className="panel">
          <SectionHeading
            title={role === "student" ? "Your sessions" : "Expected today"}
            text="Your next check-in is just a click away."
          />
          {db.bookings
            .filter(
              (b) =>
                b.date === localDate() &&
                ["Upcoming", "Active"].includes(b.status) &&
                (role === "student"
                  ? b.userId === session?.id
                  : b.libraryId === activeLibraryId),
            )
            .map((b) => (
              <button
                className="checkin-person"
                key={b.id}
                onClick={() => setFound(b)}
              >
                <Avatar name={b.name} />
                <div>
                  <strong>{b.name}</strong>
                  <small>
                    {b.id} · {timeLabel(b.start)}
                  </small>
                </div>
                <Badge status={b.status} />
                <ChevronRight size={16} />
              </button>
            ))}
          {role !== "student" && (
            <div className="p-6">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => onBook(activeLibraryId, null, true)}
              >
                <Plus size={15} /> Create a walk-in booking
              </Button>
            </div>
          )}
        </section>
      </div>
      {found && (
        <BookingDetails booking={found} onClose={() => setFound(null)} />
      )}
    </>
  );
}
export function Seats({ role, onBook }) {
  const {
    db,
    saveItem,
    removeItem,
    notify,
    activeLibraryId,
    staffLibraries,
    setActiveLibraryId,
  } = useStore();
  const libId = activeLibraryId,
    setLibId = setActiveLibraryId;
  const [edit, setEdit] = useState(null),
    [date, setDate] = useState(localDate()),
    [start, setStart] = useState("10:00");
  const manager = role === "owner" || role === "admin";
  const lib = db.libraries.find((l) => l.id === libId);
  if (!lib)
    return (
      <Empty
        title="Add your first library."
        text="Create a library before setting up its seats."
        action={
          <Button onClick={() => navigate(`/${role}/libraries`)}>
            Manage libraries
          </Button>
        }
      />
    );
  async function save(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const label = f.get("label").trim().toUpperCase();
    if (
      db.seats.some(
        (s) => s.libraryId === libId && s.label === label && s.id !== edit.id,
      )
    ) {
      notify("That seat number already exists.", "error");
      return;
    }
    try {
      await saveItem("seats", {
        ...edit,
        id: edit.id || crypto.randomUUID(),
        libraryId: libId,
        label,
        floor: Number(f.get("floor")),
        type: f.get("type"),
        status: f.get("status"),
      });
      setEdit(null);
      notify("Seat updated.");
    } catch (e) {
      notify(e.message, "error");
    }
  }
  return (
    <>
      <SectionHeading
        eyebrow="A PLACE FOR EVERY POSSIBILITY"
        title="Make space for focus."
        text="Arrange your seats, protect memberships, and welcome the next big idea."
        action={
          manager && (
            <Button
              onClick={() =>
                setEdit({
                  label: "",
                  floor: 1,
                  type: "Regular",
                  status: "Available",
                })
              }
            >
              <Plus size={16} /> Add seat
            </Button>
          )
        }
      />
      <div className="seat-management-grid">
        <section className="panel p-6">
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <Field label="Library">
              <select value={libId} onChange={(e) => setLibId(e.target.value)}>
                {staffLibraries.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Field
              label="Start time"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <SeatMap
            libraryId={libId}
            slot={{ date, start, duration: 2 }}
            manage={manager}
            onSelect={(s) => (manager ? setEdit(s) : onBook(libId, s.id, true))}
          />
        </section>
        <aside className="panel p-6">
          <span className="eyebrow">A THOUGHTFUL LAYOUT</span>
          <h3>{lib.name}</h3>
          <div className="seat-stat-list">
            {[
              "Available",
              "Occupied",
              "Reserved",
              "Protected",
              "Maintenance",
            ].map((status) => (
              <div key={status}>
                <Badge status={status} />
                <b>
                  {
                    db.seats.filter(
                      (s) =>
                        s.libraryId === libId &&
                        seatState(s, db, { date, start, duration: 2 }) ===
                          status,
                    ).length
                  }
                </b>
              </div>
            ))}
          </div>
          <div className="info-box">
            <ShieldCheck />
            <h4>Room for regulars</h4>
            <p>
              Protected monthly seats stay unavailable to hourly bookings. Click
              a seat to change its status or type.
            </p>
          </div>
        </aside>
      </div>
      {edit && (
        <Modal
          title={
            edit.id ? "A little seat maintenance" : "Make room for one more"
          }
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save}>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Seat number"
                name="label"
                defaultValue={edit.label}
                required
                maxLength={8}
              />
              <Field label="Floor">
                <select name="floor" defaultValue={edit.floor}>
                  <option value="1">Floor 1</option>
                  <option value="2">Floor 2</option>
                </select>
              </Field>
            </div>
            <Field label="Seat type">
              <select name="type" defaultValue={edit.type}>
                <option>Regular</option>
                <option>Premium</option>
                <option>Private cabin</option>
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={edit.status}>
                <option>Available</option>
                <option>Protected</option>
                <option>Maintenance</option>
              </select>
            </Field>
            <p className="text-xs text-muted mb-5">
              Reserved and occupied states are determined by bookings. Changing
              this setting does not cancel existing sessions.
            </p>
            <div className="flex justify-between">
              <Button>Save seat</Button>
              {edit.id && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={async () => {
                    if (
                      db.bookings.some(
                        (b) =>
                          b.seatId === edit.id &&
                          ["Upcoming", "Active"].includes(b.status),
                      )
                    ) {
                      notify(
                        "This seat has a booking. Cancel or finish the booking first.",
                        "error",
                      );
                      return;
                    }
                    try {
                      await removeItem("seats", edit.id);
                      setEdit(null);
                      notify("Seat removed.");
                    } catch (e) {
                      notify(e.message, "error");
                    }
                  }}
                >
                  <Trash2 size={15} /> Remove seat
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function LibraryManagement({ role }) {
  const { db, saveItem, mutate, notify, session, staffLibraries, live } =
    useStore();
  const [edit, setEdit] = useState(null),
    [qr, setQr] = useState(null),
    [suspend, setSuspend] = useState(null),
    [busy, setBusy] = useState(false);
  const admin = role === "admin";
  const owned = admin ? db.libraries : staffLibraries;
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.target);
    try {
      if (f.get("open") >= f.get("close"))
        throw new Error("Closing time must be after opening time.");
      const lat = f.get("lat") === "" ? null : Number(f.get("lat"));
      const lng = f.get("lng") === "" ? null : Number(f.get("lng"));
      if ((lat === null) !== (lng === null))
        throw new Error(
          "Enter both latitude and longitude, or leave both blank.",
        );
      if (
        lat !== null &&
        (!Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180)
      )
        throw new Error("Enter valid map coordinates.");
      const ownerId = f.get("ownerId") || edit.ownerId || session.id;
      const owner =
        db.libraries.find((l) => l.ownerId === ownerId)?.owner || session.name;
      const library = {
        ...edit,
        id: edit.id || crypto.randomUUID(),
        name: f.get("name"),
        address: f.get("address"),
        open: f.get("open"),
        close: f.get("close"),
        rules: f.get("rules"),
        price: Number(f.get("price")),
        daily: Number(f.get("daily")),
        weekly: Number(f.get("weekly")),
        monthly: Number(f.get("monthly")),
        custom: Number(f.get("custom")),
        facilities: f.getAll("facilities"),
        photo: edit.photo || libraryPhotos[0],
        owner,
        ownerId,
        lat,
        lng,
        status: edit.status || (admin || live ? "Approved" : "Pending"),
        rating: edit.rating || 0,
        reviews: edit.reviews || 0,
        distance: edit.distance ?? null,
        photos: edit.photos || [],
      };
      if (edit.id) await saveItem("libraries", library);
      else {
        const seatCount = Number(f.get("seatCount"));
        await mutate((d) => addLibrary(d, library, seatCount, session), {
          type: "library.create",
          payload: { library, seatCount },
        });
        setQr(library);
      }
      setEdit(null);
      notify("Library details saved.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function upload(e) {
    const files = [...e.target.files];
    if (
      files.some(
        (f) => !f.type.startsWith("image/") || f.size > 2 * 1024 * 1024,
      )
    ) {
      notify("Choose image files smaller than 2 MB.", "error");
      return;
    }
    try {
      const data = await Promise.all(
        files.slice(0, 4).map(
          (file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            }),
        ),
      );
      setEdit((x) => ({
        ...x,
        photo: data[0] || x.photo,
        photos: data.slice(1),
      }));
      notify("Photos ready. Save the library to apply them.");
    } catch {
      notify("Could not read this image.", "error");
    }
  }
  return (
    <>
      <SectionHeading
        eyebrow={
          admin ? "GROWING, TOGETHER" : "YOUR SPACE, THOUGHTFULLY MANAGED"
        }
        title={
          admin
            ? "Good spaces deserve a little care."
            : "Make it feel like your library."
        }
        text={
          admin
            ? "Verify, approve, and look after the spaces in our community."
            : "Update your space, pricing, photos, and the little details that matter."
        }
        action={
          <Button
            onClick={() =>
              setEdit({
                name: "",
                address: "",
                open: "06:00",
                close: "23:00",
                price: 40,
                daily: 300,
                weekly: 1500,
                monthly: 4000,
                custom: 0,
                facilities: [],
                rules: "",
                photos: [],
              })
            }
          >
            <Plus size={16} /> Add library
          </Button>
        }
      />
      <div className="management-libraries">
        {owned.map((l) => (
          <article className="managed-library panel" key={l.id}>
            <img src={l.photo} alt={l.name} />
            <div>
              <div className="flex items-center justify-between">
                <h3>{l.name}</h3>
                <Badge status={l.status} />
              </div>
              <p>
                <MapPin size={13} />
                {l.address}
              </p>
              <small>
                {l.owner} · {l.open} – {l.close}
              </small>
              <div className="managed-price">
                <strong>
                  {money(l.price)}
                  <small> / hour</small>
                </strong>
                <span>
                  {db.seats.filter((s) => s.libraryId === l.id).length} seats
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setEdit(l)}>
                  <Edit3 size={14} /> Edit details
                </Button>
                <Button variant="ghost" onClick={() => setQr(l)}>
                  <QrCode size={16} /> Library QR
                </Button>
                {admin && l.status !== "Approved" && (
                  <Button
                    onClick={async () => {
                      try {
                        await saveItem("libraries", {
                          ...l,
                          status: "Approved",
                        });
                        notify("Library approved.");
                      } catch (e) {
                        notify(e.message, "error");
                      }
                    }}
                  >
                    Approve
                  </Button>
                )}
                {admin && l.status === "Approved" && (
                  <Button variant="danger" onClick={() => setSuspend(l)}>
                    Suspend
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {edit && (
        <Modal
          wide
          title={
            edit.id
              ? "The details make the difference."
              : "A new space for new possibilities."
          }
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save}>
            <div className="grid md:grid-cols-2 gap-x-5">
              {admin && (
                <Field label="Library owner">
                  <select
                    name="ownerId"
                    defaultValue={edit.ownerId || session.id}
                  >
                    <option value={session.id}>Me ({session.name})</option>
                    {[
                      ...new Map(
                        db.libraries
                          .filter((l) => l.ownerId)
                          .map((l) => [l.ownerId, l]),
                      ).values(),
                    ].map((l) => (
                      <option key={l.ownerId} value={l.ownerId}>
                        {l.owner}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field
                label="Library name"
                name="name"
                defaultValue={edit.name}
                required
              />
              {!edit.id && (
                <Field
                  label="Number of seats"
                  name="seatCount"
                  type="number"
                  min="1"
                  max="500"
                  defaultValue="20"
                  required
                />
              )}
              <Field
                label="Address / location"
                name="address"
                defaultValue={edit.address}
                required
              />
              <Field
                label="Opening time"
                name="open"
                type="time"
                defaultValue={edit.open}
                required
              />
              <Field
                label="Closing time"
                name="close"
                type="time"
                defaultValue={edit.close}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Latitude (optional)"
                name="lat"
                type="number"
                step="any"
                min="-90"
                max="90"
                defaultValue={edit.lat ?? ""}
              />
              <Field
                label="Longitude (optional)"
                name="lng"
                type="number"
                step="any"
                min="-180"
                max="180"
                defaultValue={edit.lng ?? ""}
              />
            </div>
            <p className="text-xs text-muted mb-5">
              Coordinates enable accurate nearby search. Directions work with
              your address even when coordinates are omitted.
            </p>
            <h3 className="mt-3 mb-2">Pricing</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                ["price", "Hourly"],
                ["daily", "Daily"],
                ["weekly", "Weekly"],
                ["monthly", "Monthly"],
                ["custom", "Custom rate"],
              ].map(([key, label]) => (
                <Field
                  key={key}
                  label={`${label} (₹)`}
                  name={key}
                  type="number"
                  min={key === "custom" ? 0 : 1}
                  defaultValue={edit[key]}
                  required
                />
              ))}
            </div>
            <Field label="Facilities">
              <div className="flex flex-wrap gap-4">
                {["Wi-Fi", "AC", "Charging", "Lockers", "Café", "Parking"].map(
                  (x) => (
                    <label className="check-field" key={x}>
                      <input
                        type="checkbox"
                        name="facilities"
                        value={x}
                        defaultChecked={edit.facilities.includes(x)}
                      />
                      {x}
                    </label>
                  ),
                )}
              </div>
            </Field>
            <Field label="House rules">
              <textarea
                name="rules"
                rows={3}
                defaultValue={edit.rules}
                required
              />
            </Field>
            <Field label="Library photos (up to 4, max 2 MB each)">
              <input type="file" accept="image/*" multiple onChange={upload} />
            </Field>
            {edit.photo && (
              <img
                className="upload-preview"
                src={edit.photo}
                alt="Library photo preview"
              />
            )}
            <Button disabled={busy}>
              {busy ? "Saving…" : "Save library"}
              <Check size={15} />
            </Button>
          </form>
        </Modal>
      )}
      {qr && (
        <Modal
          title="One scan. A whole new chapter."
          onClose={() => setQr(null)}
        >
          <div className="library-qr">
            <h3>{qr.name}</h3>
            <p>
              Scan to book your study space.
              <br />
              No app installation needed.
            </p>
            {qr.status !== "Approved" && (
              <p role="status">
                Customers can book after an admin approves this library.
              </p>
            )}
            {!live && (
              <p role="status">
                Demo: this library is saved only in this browser. Booking from
                another phone requires a shared backend.
              </p>
            )}
            <QR
              value={`${location.origin}${location.pathname}#/qr/${qr.id}`}
              size={220}
              download={`${qr.id}-booking-qr.png`}
            />
            <a
              className="link"
              href={`${location.pathname}#/qr/${qr.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open mobile booking page <ArrowUpRight size={14} />
            </a>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${location.origin}${location.pathname}#/qr/${qr.id}`,
                  );
                  notify("Library link copied.");
                } catch {
                  notify("Copy the link from your address bar.", "info");
                }
              }}
            >
              Copy permanent link
            </Button>
            <p className="text-xs">
              For a phone to open this link, use the app’s reachable LAN or
              hosted address.
            </p>
          </div>
        </Modal>
      )}
      {suspend && (
        <Modal title="Suspend this library?" onClose={() => setSuspend(null)}>
          <p className="body-copy">
            {suspend.name} will be removed from student discovery and will stop
            accepting new bookings. Existing bookings remain available for staff
            to resolve.
          </p>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await saveItem("libraries", {
                  ...suspend,
                  status: "Suspended",
                });
                setSuspend(null);
                notify("Library suspended.");
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            Confirm suspension
          </Button>
        </Modal>
      )}
    </>
  );
}
export function People({ role, owners = false }) {
  const { db, saveItem, notify, session, staffLibraries } = useStore();
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(null),
    [history, setHistory] = useState(null);
  const people = owners
    ? [...new Set(db.libraries.map((l) => l.owner))].map((name, i) => ({
        id: "owner-" + i,
        name,
        email: "Library owner",
        membership:
          db.libraries.filter((l) => l.owner === name).length + " libraries",
        status: db.libraries
          .filter((l) => l.owner === name)
          .every((l) => l.status === "Suspended")
          ? "Suspended"
          : "Active",
      }))
    : db.members;
  return (
    <>
      <SectionHeading
        eyebrow="THE PEOPLE BEHIND THE POSSIBILITIES"
        title={
          owners
            ? "A community of space makers."
            : "A familiar face for every seat."
        }
        text={
          owners
            ? "Manage library owners and their spaces."
            : "Students, memberships, and their journey with your library."
        }
      />
      <section className="panel">
        <div className="table-toolbar">
          <h3>{owners ? "Library owners" : "Student directory"}</h3>
          <label className="search-input">
            <Search size={16} />
            <input
              placeholder="Search name or email"
              aria-label="Search people"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>NAME</th>
                <th>MEMBERSHIP</th>
                <th>STATUS</th>
                <th>ACTIVITY</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {people
                .filter((m) =>
                  `${m.name} ${m.email}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={m.name} />
                        <div>
                          <strong>{m.name}</strong>
                          <small>{m.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{m.membership}</td>
                    <td>
                      <Badge status={m.status} />
                    </td>
                    <td>
                      {owners
                        ? m.membership
                        : `${db.bookings.filter((b) => b.userId === m.id).length} bookings`}
                    </td>
                    <td>
                      <div className="flex gap-3">
                        {!owners && (
                          <button
                            className="link"
                            onClick={() => setHistory(m)}
                          >
                            History
                          </button>
                        )}
                        {role !== "receptionist" && (
                          <button
                            className="link"
                            onClick={() => setSelected(m)}
                          >
                            Manage
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              try {
                if (owners) {
                  await Promise.all(
                    db.libraries
                      .filter((l) => l.owner === selected.name)
                      .map((l) =>
                        saveItem("libraries", {
                          ...l,
                          status:
                            f.get("status") === "Suspended"
                              ? "Suspended"
                              : "Approved",
                        }),
                      ),
                  );
                } else
                  await saveItem("members", {
                    ...selected,
                    status: f.get("status"),
                    membership: f.get("membership"),
                  });
                setSelected(null);
                notify("Member updated.");
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            {!owners && (
              <Field label="Membership">
                <select name="membership" defaultValue={selected.membership}>
                  {["Hourly", "Daily", "Weekly", "Monthly"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={owners ? "Owner libraries status" : "Account status"}>
              <select name="status" defaultValue={selected.status}>
                <option>Active</option>
                <option>Suspended</option>
              </select>
            </Field>
            {owners && (
              <p className="text-xs text-muted mb-4">
                This changes the availability of all libraries managed by this
                owner.
              </p>
            )}
            <Button>Save changes</Button>
          </form>
        </Modal>
      )}
      {history && (
        <Modal
          wide
          title={`${history.name} · booking history`}
          onClose={() => setHistory(null)}
        >
          <BookingTable
            items={db.bookings.filter((b) => b.userId === history.id)}
          />
        </Modal>
      )}
    </>
  );
}
export function Payments({ role, reports = false }) {
  const { db, activeLibraryId } = useStore();
  const [method, setMethod] = useState("All methods"),
    [period, setPeriod] = useState("All dates");
  const bookings = db.bookings.filter(
    (b) =>
      (role === "admin" || b.libraryId === activeLibraryId) &&
      (method === "All methods" || b.method === method) &&
      (period === "All dates" || b.date === localDate()),
  );
  const paid = bookings
      .filter((b) => b.payment === "Paid")
      .reduce((s, b) => s + b.amount, 0),
    refunded = bookings
      .filter((b) => b.payment === "Refunded")
      .reduce((s, b) => s + b.amount, 0);
  function exportCsv() {
    const rows = [
      ["Booking ID", "Student", "Date", "Amount", "Method", "Status"],
      ...bookings.map((b) => [
        b.id,
        b.name,
        b.date,
        b.amount,
        b.method,
        b.payment,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), "librabook-report.csv");
  }
  return (
    <>
      <SectionHeading
        eyebrow={
          reports
            ? "SMALL INSIGHTS. BETTER DAYS."
            : "THE NUMBERS, WITH A LITTLE CLARITY"
        }
        title={reports ? "See how your space is growing." : "Good days add up."}
        text={
          reports
            ? "Revenue, occupancy, and the seats your students love."
            : "Payments, refunds, and the story behind every session."
        }
        action={
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </Button>
        }
      />
      <div className="stat-grid three">
        {[
          ["Collected revenue", money(paid)],
          ["Refunded", money(refunded)],
          [
            role === "admin" ? "Commission (10% demo)" : "Transactions",
            role === "admin" ? money(paid * 0.1) : bookings.length,
          ],
        ].map(([label, value]) => (
          <article className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>Based on the selected filters</p>
          </article>
        ))}
      </div>
      {reports && (
        <div className="dashboard-mid">
          <section className="panel">
            <SectionHeading title="Revenue trends" text="Last seven days" />
            <RevenueChart bookings={bookings} />
          </section>
          <section className="panel p-6">
            <h3>Popular seats</h3>
            <p className="text-muted text-xs mt-2 mb-5">
              Most booked spots in your space.
            </p>
            {Object.entries(
              bookings.reduce(
                (a, b) => ({ ...a, [b.seatId]: (a[b.seatId] || 0) + 1 }),
                {},
              ),
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([id, count]) => (
                <div className="popular-seat" key={id}>
                  <Armchair size={17} />
                  <span>
                    Seat {db.seats.find((s) => s.id === id)?.label || "Removed"}
                  </span>
                  <div
                    style={{
                      width: `${(count / Math.max(bookings.length, 1)) * 100}%`,
                    }}
                  />
                  <b>{count}</b>
                </div>
              ))}
            <div className="panel-foot">
              {bookings.filter((b) => b.status === "Active").length} active ·{" "}
              {bookings.filter((b) => b.status === "Completed").length}{" "}
              completed
            </div>
          </section>
        </div>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <h3>Payment history</h3>
          <div className="flex gap-3">
            <select
              aria-label="Payment method filter"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {["All methods", "UPI", "Card", "Cash", "Wallet"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              aria-label="Payment date filter"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option>All dates</option>
              <option>Today</option>
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>TRANSACTION</th>
                <th>STUDENT</th>
                <th>DATE</th>
                <th>METHOD</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.name}</td>
                  <td>{b.date}</td>
                  <td>{b.method}</td>
                  <td>{money(b.amount)}</td>
                  <td>
                    <Badge status={b.payment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!bookings.length && (
          <Empty text="No transactions match these filters." />
        )}
      </section>
    </>
  );
}
export function Moderation({ reviews = false }) {
  const { db, saveItem, notify } = useStore(),
    [filter, setFilter] = useState("All");
  const collection = reviews ? "reviews" : "complaints";
  return (
    <>
      <SectionHeading
        eyebrow="A COMMUNITY WORTH CARING FOR"
        title={
          reviews
            ? "Listen. Learn. Make it better."
            : "Every concern deserves a little care."
        }
        text={
          reviews
            ? "Review community feedback and keep conversations useful."
            : "Follow up on issues and help your spaces stay welcoming."
        }
      />
      <div className="tabs mb-6">
        {(reviews
          ? ["All", "Published", "Hidden"]
          : ["All", "Open", "In progress", "Resolved"]
        ).map((x) => (
          <button
            key={x}
            className={x === filter ? "active" : ""}
            onClick={() => setFilter(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="moderation-list">
        {db[collection]
          .filter((x) => filter === "All" || x.status === filter)
          .map((x) => (
            <article className="panel p-6" key={x.id}>
              <div className="flex items-center gap-3">
                <Avatar name={x.name} />
                <div>
                  <h3>{x.name}</h3>
                  <p className="text-xs text-muted mt-1">
                    {db.libraries.find((l) => l.id === x.libraryId)?.name}
                  </p>
                </div>
                <div className="ml-auto">
                  <Badge status={x.status} />
                </div>
              </div>
              <p className="body-copy">{x.text || x.message}</p>
              {reviews && (
                <span className="text-amber-600">{"★".repeat(x.rating)}</span>
              )}
              <div className="flex gap-3 mt-4">
                {(reviews
                  ? [x.status === "Published" ? "Hidden" : "Published"]
                  : ["Open", "In progress", "Resolved"]
                )
                  .filter((s) => s !== x.status)
                  .map((s) => (
                    <Button
                      key={s}
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await saveItem(collection, { ...x, status: s });
                          notify("Updated.");
                        } catch (e) {
                          notify(e.message, "error");
                        }
                      }}
                    >
                      {reviews
                        ? s === "Hidden"
                          ? "Hide review"
                          : "Publish review"
                        : s}
                    </Button>
                  ))}
              </div>
            </article>
          ))}
      </div>
      {!db[collection].some((x) => filter === "All" || x.status === filter) && (
        <Empty text="Nothing needs your attention here." />
      )}
    </>
  );
}
