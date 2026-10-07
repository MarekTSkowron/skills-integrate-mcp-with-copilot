# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Allow staff to sign up and unregister students
- Protect staff actions with a login session

## Getting Started

1. Install the dependencies from the repository root:

   ```
   pip install -r requirements.txt
   ```

2. Configure the staff credentials and a private session-signing secret. Do not commit these values to the repository:

   ```
   export ADMIN_USERNAME=teacher
   export ADMIN_PASSWORD='use-a-strong-unique-password'
   export ADMIN_SESSION_SECRET="$(openssl rand -hex 32)"
   ```

   `ADMIN_SESSION_SECRET` must be at least 32 characters. Keep it private; changing it logs out all active staff sessions.

3. Start the application from the `src` directory:

   ```
   cd src
   uvicorn app:app --reload
   ```

   If the admin credentials are not configured, activities remain viewable, but staff login and registration changes are unavailable.

4. Open your browser and go to:
   - Activities page: http://localhost:8000/
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participants      |
| GET    | `/admin/session`                                                  | Check whether staff login is configured and active                  |
| POST   | `/admin/login`                                                    | Log in with the configured staff username and password              |
| POST   | `/admin/logout`                                                   | End the current staff session                                        |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Staff: sign up a student for an activity                             |
| DELETE | `/activities/{activity_name}/unregister?email=student@mergington.edu` | Staff: unregister a student                                        |

## Data Model

The application uses a simple in-memory data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

All activity data is stored in memory, which means it resets when the server restarts. Staff credentials and the session-signing secret are read from environment variables rather than stored in the repository.
