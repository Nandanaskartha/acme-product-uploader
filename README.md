## Step 1: Creating the project structure
## Step:2 : Postgres db setup on render and db connection setup
## Step 3: feat: add minimal frontend upload page and initialize FastAPI, Celery, and Redis setup

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