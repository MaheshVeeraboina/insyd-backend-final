# Insyd Notification Backend

This is the backend API for Insyd, a next-gen social web platform for the Architecture Industry, implementing a proof-of-concept notification system using Node.js, Express, and SQLite.

## Project Overview

The backend provides RESTful endpoints to manage users, events, and notifications.  
Users receive notifications based on activities such as likes, comments, follows, or new posts.

## Features

- User creation and retrieval
- Event creation to track user activities
- Automatic notification creation from events
- Fetch user notifications
- Mark notifications as read

## Technology Stack

- Node.js
- Express.js
- SQLite (via `sqlite` and `sqlite3` npm packages)

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm (Node package manager)

### Installation

1. Clone the repository:

git clone <repository-url>
cd insyd-backend

text

2. Install dependencies:

npm install

text

### Running the Server

Start the server on port 3001:

node server.js

text

The SQLite database file `insydNotification.db` will be created automatically if it doesn't exist.

### API Endpoints

- `GET /`  
  Health check, returns a simple message.

- `POST /users`  
  Create a new user.  
  Request body JSON:
{
"username": "alice",
"email": "alice@example.com",
"preferences": "in-app"
}

text

- `GET /users/:user_id`  
Get user information by ID.

- `POST /events`  
Create an event (like, follow, comment). Automatically generates a notification.  
Request body JSON:
{
"type": "like",
"source_user_id": 1,
"target_user_id": 2,
"data": "Liked post 123"
}

text

- `GET /notifications/:user_id`  
Get last 50 notifications for a user, sorted newest first.

- `POST /notifications/:notification_id/read`  
Mark a notification as read.

## Testing the API

You can test the API using tools like [Postman](https://www.postman.com/) or [curl](https://curl.se/).

Example: Create a user

curl -X POST http://localhost:3001/users -H "Content-Type: application/json" -d '{"username":"alice", "email":"alice@example.com"}'

text

## Notes

- This project is a proof-of-concept; no authentication is implemented.
- The database resets if the `insydNotification.db` file is deleted.
- Adaptations can be made to move from SQLite to more scalable databases for production.

## License

MIT License

---

For questions or contributions, feel free to create issues or pull requests.
