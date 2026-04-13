SELECT u.email, u.role, COUNT(ps.id) as subs FROM "User" u LEFT JOIN "PushSubscription" ps ON ps."userId" = u.id GROUP BY u.email, u.role ORDER BY subs DESC;
