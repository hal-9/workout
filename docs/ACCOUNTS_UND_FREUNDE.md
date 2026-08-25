# Registrierung, Onboarding und Freunde (M13)

Ergänzt die App um Selbst-Registrierung per E-Mail, Tutorial-Screens beim ersten Login
und gegenseitige Freundschaften statt "jeder sieht jeden".

## Was sich geändert hat

**Login läuft jetzt über die E-Mail-Adresse, nicht mehr über den Namen.**
Der Name ist nur noch Anzeigename für Freunde.

Bestandsnutzer haben keine E-Mail in der DB. Bis sie eine bekommen (siehe Deploy),
funktioniert übergangsweise weiter der Name im E-Mail-Feld — deshalb ist das Feld
`type="text"` und nicht `type="email"`. Nach dem Backfill kann der Fallback in
`backend/src/accounts.js` (`findUserForLogin`) raus.

## Registrierung

`POST /api/register` mit `{ name, email, password, invite_code }`. Bei Erfolg wird
direkt eine Session gesetzt — kein zweiter Login-Schritt.

Die Registrierung ist durch einen **Einladungscode** geschützt:

- `REGISTER_INVITE_CODE` in der Env setzen, Code den Freunden per WhatsApp o. ä. schicken.
- **Ist die Variable nicht gesetzt, ist die Registrierung komplett zu** (403 für jeden
  Versuch). Fail closed: ein vergessener Deploy-Wert öffnet die App nicht für Bots.
- Code rotieren = Env-Wert ändern + `docker compose up -d api`.

Bewusst **nicht** enthalten: E-Mail-Verifikation und Passwort-Reset. Dafür bräuchte es
einen SMTP-Dienst, den das Setup nicht hat. Die E-Mail ist also unbestätigt und dient
als Login-Kennung plus Adresse für Freundschaftsanfragen. Vergisst jemand sein Passwort,
muss der Hash von Hand in der DB ersetzt werden.

## Onboarding

`users.onboarded_at` steuert das Tutorial — bewusst in der DB und nicht im
localStorage, damit es beim Gerätewechsel oder nach PWA-Neuinstallation nicht
wieder auftaucht.

- Migration setzt das Feld für alle **bestehenden** Nutzer auf `now`, die sehen das
  Tutorial also nie.
- `AuthGuard` schickt jeden Nutzer ohne Flag auf `/willkommen`.
- Letzter Screen ruft `POST /api/me/onboarded` und leitet auf `/plan` weiter, wo der
  Plan-Wizard schon steht.
- `OnboardingRoute` merkt sich den Stand beim Betreten (`useRef`). Ohne das würde der
  Guard den Nutzer in dem Moment rauswerfen, in dem das Tutorial das Flag setzt.

Texte stehen als `SLIDES`-Array oben in `frontend/src/screens/Onboarding.jsx`.

## Freunde

Vorher lieferte `GET /api/users` **alle** Nutzer und `/api/partner/progress` gab jeden
beliebigen Fortschritt an jeden eingeloggten Nutzer heraus. Mit Selbst-Registrierung
wäre das ein Datenleck zwischen Fremden.

Jetzt: Tabelle `friendships` mit `pending` -> `accepted`.

| Route | Zweck |
| --- | --- |
| `GET /api/friends` | `{ friends, incoming, outgoing }` |
| `POST /api/friends/requests` | `{ email }` — Anfrage stellen |
| `POST /api/friends/requests/:id/accept` | annehmen (nur Empfänger) |
| `DELETE /api/friends/requests/:id` | ablehnen oder zurückziehen |
| `DELETE /api/friends/:userId` | Freundschaft beenden |

- `GET /api/users` liefert nur noch bestätigte Freunde.
- `/api/partner/progress` prüft die Freundschaft und antwortet sonst **403** — und zwar
  *vor* der 404-Prüfung, damit die Antwort nicht verrät, welche `user_id` existiert.
- Ablehnen und Entfernen löschen die Zeile, damit später erneut angefragt werden kann.
- Stellt B eine Anfrage, während A schon eine offene an B hat, wird die bestehende
  direkt angenommen.
- `POST /api/friends/requests` antwortet mit 404, wenn es die E-Mail nicht gibt. Das
  verrät, ob eine Adresse registriert ist — im Freundeskreis akzeptiert, weil die
  Alternative (immer 200) einen Tippfehler unauffindbar macht.

## Deploy-Schritte

1. `REGISTER_INVITE_CODE` in `deploy/.env` setzen.
2. `SEED_USER<N>_EMAIL` für **jeden bestehenden Nutzer** setzen. `npm run seed` trägt die
   Adresse bei vorhandenen Nutzern nach (legt sie nicht doppelt an).
3. Deployen. Migration `003_accounts_friends.sql` läuft beim Start automatisch.
4. Einmal mit der neuen E-Mail einloggen und prüfen, dass es klappt.
5. Bestehende Trainingspartner müssen sich **einmal gegenseitig als Freunde bestätigen**,
   sonst ist der Partner-Tab im Fortschritt leer.

## Bekannte Lücken

- **Kein Rate-Limiting** auf `/api/login`. Das galt vorher schon, wird durch eine
  öffentlich erreichbare Registrierung aber relevanter.
- Kein Passwort-Reset (siehe oben).
- E-Mails sind unbestätigt.
