export const legacyOwnerIds = {
  "Atul Tiwari": "owner-1",
  "Meera Shah": "owner-2",
  "Arjun Mehta": "owner-3",
  "Ravi Verma": "owner-4",
};

export function addLibrary(db, library, seatCount, actor) {
  if (!["admin", "owner"].includes(actor?.role))
    throw new Error("Sign in as a library manager to add a library.");
  if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 500)
    throw new Error("Choose between 1 and 500 seats.");
  if (db.libraries.some((l) => l.id === library.id))
    throw new Error("This library already exists.");
  const saved = {
    ...library,
    ownerId: actor.role === "owner" ? actor.id : library.ownerId || actor.id,
    owner: actor.role === "owner" ? actor.name : library.owner || actor.name,
    status: actor.role === "admin" ? "Approved" : "Pending",
  };
  return {
    ...db,
    libraries: [saved, ...db.libraries],
    seats: [
      ...db.seats,
      ...Array.from({ length: seatCount }, (_, i) => ({
        id: `${saved.id}-seat-${i + 1}`,
        libraryId: saved.id,
        label: `A${String(i + 1).padStart(2, "0")}`,
        floor: 1,
        type: "Regular",
        status: "Available",
      })),
    ],
  };
}

// Keep existing browser-demo workspaces compatible with stable ownership IDs.
export function normalizeWorkspace(db) {
  return {
    ...db,
    libraries: db.libraries.map((l) => ({
      ...l,
      ownerId: l.ownerId || legacyOwnerIds[l.owner] || null,
    })),
  };
}

export function assignedLibraries(db, session) {
  if (!session) return [];
  if (session.role === "admin") return db.libraries;
  if (session.role === "owner")
    return db.libraries.filter(
      (l) => (l.ownerId || legacyOwnerIds[l.owner]) === session.id,
    );
  if (session.role === "receptionist")
    return db.libraries.filter((l) =>
      (session.libraryIds || ["studyhub"]).includes(l.id),
    );
  return [];
}

export function libraryDistance(position, library) {
  if (
    ![position?.lat, position?.lng, library.lat, library.lng].every(
      Number.isFinite,
    )
  )
    return null;
  const r = Math.PI / 180;
  const h =
    Math.sin(((library.lat - position.lat) * r) / 2) ** 2 +
    Math.cos(position.lat * r) *
      Math.cos(library.lat * r) *
      Math.sin(((library.lng - position.lng) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
