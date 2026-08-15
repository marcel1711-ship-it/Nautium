# Fleet Management Platform

A production-ready, multi-tenant SaaS platform built for the maritime industry. Designed for yacht owners, charter operations, and fleet management companies who need a single system to control maintenance, inventory, fuel, costs, and crew across multiple vessels.

---

## What the Software Does

### Preventive Maintenance Management
Schedule, track, and complete maintenance tasks with custom recurrence intervals (daily, weekly, monthly, quarterly, semi-annual, annual, or custom number of days). Each task can be assigned to a specific crew member, linked to a piece of equipment, and configured with reminders before the due date. When a task is completed, the system logs who did it, when, what parts were used, any issues found, and photos of the work. Inventory stock is automatically deducted upon task completion.

### Equipment Registry
Maintain a full catalog of onboard machinery and systems (engines, generators, watermakers, HVAC, navigation equipment, etc.) with manufacturer, model, serial number, and onboard location. All maintenance tasks and history are linked to the relevant equipment.

### Inventory & Spare Parts Control
Track every spare part and consumable on each vessel with minimum stock thresholds. The system flags items below minimum stock and shows low-stock alerts on the dashboard. Stock movements (in, out, adjustment) are logged with reason and performer. Inventory can be exported to a PDF report with valuation by unit cost.

### Fuel & Consumables Tracking
Monitor levels for diesel, fresh water, engine oil, hydraulic oil, waste water, and any other fluid resource on each vessel. Log refills and consumption events with cost, supplier, location, and engine hours. Low-level alerts are shown per resource. Full history with summary statistics can be exported to PDF.

### Cost Tracking
Consolidated financial view across all vessel expenses:
- **Fuel costs** — from fuel log entries with supplier and quantity
- **Parts used** — spare parts consumed during maintenance, valued at unit cost
- **External service costs** — third-party labor logged during task completion
- **Operational expenses** — mooring fees, electricity, water, internet, waste disposal, port fees, insurance, and other recurring costs

Period filters (last month, 3 months, 6 months, 1 year, all-time) and per-vessel breakdowns allow precise budget analysis.

### Inventory Valuation
Real-time valuation of all onboard stock at unit cost, broken down by spare parts and consumables, per vessel or across the entire fleet.

### Maintenance History & Audit Trail
Every completed task is permanently recorded with full detail: completion date, assigned person, comments, parts used with quantities and values, issues detected, and attached photos. Searchable and filterable by vessel, date range, and performer. Exportable to PDF.

### Digital Manuals Library
Upload and store maintenance manuals (PDF, DOC, DOCX) organized by vessel and equipment. Manuals are searchable by title and filterable by vessel or equipment. Any team member can download or view documents directly from the platform.

### Real-Time Dashboard
Role-specific dashboards showing fleet health at a glance:
- Vessel health gauges (maintenance + inventory health as percentages)
- Urgent action alerts (critical overdue tasks, items due within 48h, out-of-stock items)
- Overdue tasks counter, due-soon tasks, upcoming maintenance, low stock items
- Recent activity feed of completed work
- Quick links to take immediate action

### Email Alert Notifications
Automated daily email summaries sent to company admins listing overdue and due-soon maintenance tasks and low-stock inventory items. Built on Resend with HTML-formatted emails including task priority, vessel, due date, and current vs. minimum stock levels.

### Multi-Tenant Customer Management
Master admins manage all client companies from a single interface — view subscription status (active/trial/inactive), vessel count, user count, renewal dates, and contact information. One-click access to manage any customer's vessels and users.

### User & Access Management
Three-tier role system with strict data isolation:
- **Master Admin** — full platform access, manages all customers and configuration
- **Customer Admin** — manages their company's vessels, tasks, inventory, and users
- **Standard User** — access only to assigned vessels, can view and complete tasks

Users are assigned to specific vessels. All data is filtered by vessel assignment — a user only sees what they're assigned to.

### QR Code Location System
Generate QR codes for physical storage locations on each vessel. Scanning the QR code identifies the location for inventory tracking.

### Bilingual Interface
Full English and Spanish support. Language can be toggled from settings or from the public landing page. All UI strings, labels, and navigation are translated.

### Public Landing Page
Marketing-ready landing page with feature overview, customer profiles, testimonials, a contact/demo request form, and bilingual support.

---

## User Roles

| Role | Access |
|---|---|
| Master Admin | All companies, all vessels, all data, user creation, customer management |
| Customer Admin | Own company's vessels, users, tasks, inventory, costs |
| Standard User | Assigned vessel(s) only, maintenance tasks, inventory view |

---

## Tech Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Supabase** — PostgreSQL database, authentication, row-level security, storage, edge functions
- **Resend** — transactional email for daily alert notifications
- **pg_cron** — scheduled daily alert jobs

---

## Database Schema

| Table | Purpose |
|---|---|
| `companies` | Multi-tenant customer accounts with subscription info |
| `vessels` | Individual vessels belonging to companies |
| `profiles` | User profiles with roles and company assignment |
| `user_vessels` | Many-to-many vessel access per user |
| `equipment` | Onboard machinery and systems per vessel |
| `maintenance_tasks` | Scheduled maintenance with recurrence and assignments |
| `maintenance_history` | Completed task records with full detail |
| `maintenance_history_parts` | Parts used per completed task |
| `inventory_items` | Spare parts and consumables per vessel |
| `stock_movements` | Every inventory transaction |
| `fuel_resources` | Trackable fluid resources per vessel |
| `fuel_log` | Refill and consumption entries per resource |
| `operational_expenses` | Mooring, utilities, insurance, and other costs |
| `maintenance_manuals` | Uploaded documents per vessel/equipment |

---

## Security

- Row-Level Security (RLS) enabled on all tables
- All policies check `auth.uid()` — no open policies
- Data isolation enforced at the database level by `company_id` and `vessel_id`
- Edge functions use `SUPABASE_SERVICE_ROLE_KEY` only for admin operations, never exposed to the client
- Role-based access control enforced both in UI and database policies

---

## Demo Accounts

Password for all demo accounts: `demo123`

| Role | Email |
|---|---|
| Master Admin | admin@yachtmaintenance.pro |
| Customer Admin | captain@oceanicluxury.com |
| Standard User | chief.engineer@oceanicluxury.com |

---

## Build

```bash
npm install
npm run build
```
