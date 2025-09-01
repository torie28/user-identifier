# User Identifier Application

A simple web application for managing users, built with Python Flask and SQLAlchemy.

## Features

- Create new users with username and email
- View list of all users
- Edit existing users
- Delete users
- Responsive design that works on mobile and desktop

## Prerequisites

- Python 3.7 or higher
- pip (Python package installer)

## Installation

1. Clone the repository or download the source code
2. Navigate to the project directory:
   ```
   cd user-identifier-app
   ```
3. Create a virtual environment (recommended):
   ```
   python -m venv venv
   ```
4. Activate the virtual environment:
   - On Windows:
     ```
     .\venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```
     source venv/bin/activate
     ```
5. Install the required packages:
   ```
   pip install -r requirements.txt
   ```

## Running the Application

1. Make sure you're in the project directory and your virtual environment is activated
2. Run the Flask application:
   ```
   python app.py
   ```
3. Open your web browser and navigate to:
   ```
   http://127.0.0.1:5000/
   ```

## Project Structure

```
user-identifier-app/
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
├── templates/
│   └── index.html
├── models/
│   ├── __init__.py
│   └── user.py
├── controllers/
│   └── user_controller.py
├── app.py
├── requirements.txt
└── README.md
```

## API Endpoints

- `GET /api/users` - Get all users
- `POST /api/users` - Create a new user
- `GET /api/users/<id>` - Get a specific user
- `PUT /api/users/<id>` - Update a user
- `DELETE /api/users/<id>` - Delete a user

## License

This project is open source and available under the [MIT License](LICENSE).
