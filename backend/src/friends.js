export function areFriends(db, userA, userB) {
  const row = db
    .prepare(
      `SELECT 1 FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`
    )
    .get(userA, userB, userB, userA);
  return Boolean(row);
}

export function listFriends(db, userId) {
  return db
    .prepare(
      `SELECT users.id, users.name
       FROM friendships
       JOIN users ON users.id = CASE
         WHEN friendships.requester_id = ? THEN friendships.addressee_id
         ELSE friendships.requester_id
       END
       WHERE friendships.status = 'accepted'
         AND (friendships.requester_id = ? OR friendships.addressee_id = ?)
       ORDER BY users.name`
    )
    .all(userId, userId, userId);
}

export function findEdge(db, userA, userB) {
  return db
    .prepare(
      `SELECT * FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
    )
    .get(userA, userB, userB, userA);
}
