# GSO Inventory Management

Inventory dashboard for the **General Services Office, Municipal Government of El Nido**.
It keeps a single register of property records and generates the official COA / LGU
inventory forms from those records, so nothing has to be re-typed per document.

## Tech Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 (JSX) |
| Build | Vite 8 |
| Routing | React Router 7 |
| Spreadsheets | ExcelJS 4 |
| State | React Context + browser `localStorage` |
| Styling | Plain CSS (`src/styles/global.css`) |

## Getting Started

Requires Node.js 18 or later.

```bash
npm install
npm run dev      # start the dev server
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

> Open the app on `localhost` or HTTPS. Password hashing uses the Web Crypto API,
> which browsers only expose in secure contexts.

## Accounts & Roles

Sign-in starts with a **position picker**; the selected position must match the
role stored on the account. Registration is only reachable from that first screen.

| Role | Scope |
| --- | --- |
| **Staff** | Full access to every page |
| **Fuel/Vehicle** | Fleet register, assignments, transfers, inspection, activity logs |
| **Warehouse Staff** | Warehouse inventory, physical inventory, assignments, transfers, inspection, forms, reports |

A built-in account is available:

| Username | Password |
| --- | --- |
| `Staff` | `Staff1323` |

Everything is stored client-side for prototype use — there is no backend. The
built-in account's password can be changed from Profile Settings.

## Application Structure

| Route | Page |
| --- | --- |
| `/login` | Position picker + sign in |
| `/register` | Account registration |
| `/` | Dashboard (role-aware) |
| `/profile` | Profile Settings |
| `/assets` | Asset Management — register, search, group, sort |
| `/disposal` | Disposal & Missing |
| `/forms` | Forms — Excel template exports |
| `/physical-inventory` | Physical Inventory |
| `/assignments` | Property Assignments |
| `/transfers` | Property Transfers |
| `/inspection` | Inspection & Repair |
| `/departments` | Departments |
| `/reports` | Reports |
| `/activity-logs` | Activity Logs |

All routes except `/login` and `/register` sit behind authentication and the
shared `Layout` (sidebar + header).

## Core Features

### Asset Register

- Registration starts with a **Form Type** selection; only the fields that form
  needs are rendered, so the user never fills in irrelevant inputs.
- Search, filter by classification, group (Classification, Department, Category,
  Condition, Status) and sort (numeric-aware).
- Every form's registration schema lives in `src/data/assetForms.js`.

### Automatic Property Numbers

New records are issued a property number in the format **`YYYY-MM-####`**
(e.g. `2026-11-0001`):

- The prefix is the current year and month; the sequence **restarts each month**.
- The next number continues from the highest number already recorded for that month.
- The field stays editable, so a manual number can still be entered.
- Duplicate property numbers are rejected on save.
- Road Inventory is exempt — it uses that field as an optional *Road Network ID No.*

Implemented by `nextPropertyNo()` in `src/services/assetService.js`.

### Classification Rule

Item value decides the classification, and it is applied as soon as a cost is typed:

| Unit cost | Classification |
| --- | --- |
| Below ₱50,000 | Semi-Expendable |
| **₱50,000 and above** | **Expendable** |

The threshold (`UNIT_VALUE_THRESHOLD`) and `classifyByCost()` live in
`src/services/assetService.js`. The computed value stays editable so special
cases (Land, Land Improvement) can be set manually.

### Disposal & Missing

`/disposal` derives both lists from the register instead of asking for separate
filing:

- **Unserviceable / Disposed** — records whose `Condition` is *Unserviceable*.
- **Non-Existing / Missing PPEs** — records whose `Status` is *Missing* (or whose
  remarks match "missing" / "non-existing").

Quick flag pickers move a record onto a list, and **Restore** / **Found** actions
move it back. Both lists ignore the form-type filter and scan all records.

### Forms & Excel Exports

`/forms` lists every official template and exports it from the register. Each
template declares a `formType`, so an export only contains the records filed
under that registration form (the two auto-generated lists are the exception).

### Activity Logs

Assignment and transfer actions write descriptive log entries. `Activity Logs`
presents them as a searchable, filterable table with readable timestamps,
colour-coded action labels, a per-event summary, and CSV export of the filtered
results.

### Profile Settings

Reachable from the avatar menu in the **upper-right of the header**, alongside
Sign Out. Two panels:

- **Account Details** — Full Name (required), Email (validated), Phone,
  Department / Office, Designation, plus read-only Position and Username.
- **Change Password** — current password plus new password (minimum 8
  characters) and confirmation.

Profile details persist to `localStorage` (`gso-user-profiles`) and sync the
active session. Works for both registered accounts and the built-in `Staff`
account.

### Branding

- The GSO logo appears in the header bar and beside the El Nido logo on the
  sign-in/registration screen.
- The GSO logo is also used as a low-opacity watermark behind the whole app
  (~5%) and the auth screens (~6%), positioned so it never interferes with text.

## Excel Templates

19 official templates are available. All are configured for **A4** printing,
**fit to one page wide**, horizontally centred, with **landscape** orientation on
the wide forms.

| Template | Reference |
| --- | --- |
| ICS — Inventory Custodian Slip | Appendix 59 |
| PARE — Property Acknowledgement Receipt | Appendix 9-8 |
| IIRUP — Unserviceable PPE | Appendix 67 |
| IIRU-SP — Unserviceable Semi-Expendable | Annex A.10 |
| ITR — Inventory Transfer Report | Annex A.5 |
| Property Card | Annex 37 |
| Property Card (COA) | Appendix 69 |
| RPCPPE | Appendix 73 |
| RPC — Land & Land Improvements | Appendix 62 |
| RPC — Local Road Network | Appendix 63 |
| RPC — Other Public Infrastructure | Appendix 64 |
| RPC — Buildings & Structures | Appendix 65 |
| RPC — Equipment, Furniture & Fixtures | Appendix 66 |
| Road Inventory | 2026 barangay road survey |
| Report on LRN with No MEO Record | — |
| IIRUP by Office (one sheet per department) | Appendix 67 |
| List of Unserviceable / Disposed Equipment | Auto-generated |
| List of Non-Existing / Missing PPEs | Auto-generated |
| Property Number Sticker | — |

### Export Conventions

- **Minimum 16 body rows.** Every tabular form pads its table body out to 16
  rows with bordered, empty cells. Extra rows are only added when there are more
  than 16 records, so the table never grows in small steps.
- **Road Inventory** produces one worksheet per barangay, groups roads by
  classification, and carries construction years, total length, surface
  measurements/share and surface condition, with the prepared/approved block.
  Worksheets match the 2026 barangay road survey layout.
- **ICS** follows Appendix 59 exactly: two-level *Amount* header (Unit Cost /
  Total Cost), 24 lined item rows, received-from / received-by signature blocks,
  and P.O. Number / Supplier footer. Fund Cluster and ICS No. are optional
  registration fields.
- **RPC forms** (Appendices 62–66, 73) share the standard three-column
  certification block: *Certified Correct by* (Engr. Remedios A. Ulanday),
  *Approved by* (Hon. Edna Gacot-Lim, Municipal Mayor) and *Verified by*
  (COA Representative).
- **Property Number Stickers** are grouped into one worksheet per registration
  form *and* colour band — Yellow `PARE NO` for Expendable, Green `ICS NO` for
  Semi-Expendable — and carry the El Nido logo.

## Recent Updates

### 2026-11-11

- **Profile Settings** — added the upper-right avatar menu (Profile Settings /
  Sign Out) and a `/profile` page for editing account details and changing the
  password, persisted to `localStorage`.
- **Branding** — added the GSO logo to the header and auth screen, deliberately
  centred vertically against the title, plus a low-opacity logo watermark behind
  the app and auth screens.
- **Routing fix** — sign-in moved to `/login` and `/` now serves the protected
  dashboard. Previously `/` rendered the login page, so after signing in the
  Dashboard link sent the user back to the login screen.
- **Automatic property numbers** — new records are issued `YYYY-MM-####`
  numbers, with the sequence restarting monthly.
- **Classification threshold** — ₱50,000 is now *inclusive*, so an item costing
  exactly ₱50,000 is Expendable (previously Semi-Expendable).
- **Road Inventory revised** — registration now collects road-specific fields
  (classification, construction years, length, surface type/measurements,
  condition) with the generic PPE register section removed; the export produces
  one worksheet per barangay matching the supplied 2026 template.
- **ICS export** — restructured to match the Appendix 59 template.
- **Excel row padding** — every tabular form now contains at least 16 rows.
- **RPC templates** — added the standard certification/signature blocks, aligned
  Appendix 73 column headers, and corrected the Appendix 66 title.

## Known Limitations

- Data lives in browser `localStorage`; it is per-browser and not shared.
- The production bundle emits a large-chunk warning; the app is not yet
  code-split.
- Exports are generated from records registered in the app — existing workbook
  files are not imported.
