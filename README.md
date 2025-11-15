Scalable web application for bulk CSV product imports, management, and webhook integration with FastAPI, Celery, and PostgreSQL.

🚀 Overview
A high-performance web app that lets users upload, manage, and automate the import of up to 500,000 products via CSV. This platform simplifies large dataset handling, supports full product lifecycle management, and offers event-driven integration via webhooks.

✨ Features
Large CSV Uploads: Import up to 500k products directly from the browser, with progress feedback.

Robust Product Management: View, create, update, delete, and filter products from a minimalist UI.

Intelligent Deduplication: Ensures SKU uniqueness and auto-overwrites based on case-insensitive matching.

Bulk Operations: One-click bulk delete with confirmation for secure mass editing.

Webhook Automation: Configure and manage multiple webhooks to receive real-time events (create/update/delete).

Responsive Interface: Clean, feedback-rich UI for seamless user experience.

Async Background Processing: Celery workers for non-blocking CSV import and outbound webhook triggers.


🛠️ Tech Stack

Backend: FastAPI (Python)

Async Tasks: Celery + Redis 

ORM: SQLAlchemy

Database: PostgreSQL

Frontend: React 

Deployment: Render

🧩 Folder Structure
text
fastapi-csv-product-importer/
├── app/
│   ├── api/           # API routers for upload, products, webhooks
│   ├── crud/          # CRUD logic and DB operations
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic schemas
│   ├── services/      # Business logic (webhook, bulk operations)
│   ├── progress.py    # To track the progress of jobs
│   ├── database.py    # DB configuration
│   ├── celery_app.py  # Celery setup
│   └── main.py        # FastAPI entrypoint
├── frontend/          #  React
├── requirements.txt          
├── .gitignore
├── alembic.ini       
├── README.md                     


## Step 1: Creating the project structure
## Step:2 : Postgres db setup on render and db connection setup
## Step 3: Add minimal frontend upload page and initialize FastAPI, Celery, and Redis setup

- Added simple react frontend for CSV upload
- Configured FastAPI app with upload endpoint
- Initialized Celery worker with Redis broker & backend
- Added basic task wiring between FastAPI and Celery

## Step 4: Add product listing with pagination

- GET /products endpoint with query parameters
- Pagination support (page, limit)
- Full-text search across SKU, name, description
- Filter by active status
- Story 2: Product Management UI (Read)"

### Add update and delete endpoints

- PUT /products/{id} with partial updates
- DELETE /products/{id} with existence check
- SKU conflict detection on updates
- Story 2: Product Management UI (Update, Delete)"

## Step 4: Add bulk delete endpoint and notification component

- DELETE /products/bulk-delete for clearing database
- Returns count of deleted records
- Story 3: Bulk Delete from UI"

## Step 5:  Add APIs and UI for managing webhooks:

- Store webhook configs in DB (URL, event type, enabled/disabled).
- UI allows users to add, edit, delete, and test webhooks.
- Test endpoint triggers sample event and returns visible HTTP response code/time.
- Ensure webhook calls are dispatched asynchronously (Celery).
- Story 4: Webhook Configuration via UI"

## Step 6: Add APIs and WebHook for Bulk Delete and CSV Upload

