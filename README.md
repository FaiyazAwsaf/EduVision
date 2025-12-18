# EduVision

A full-stack educational platform built with Django (backend) and Next.js (frontend).

## Project Structure

```
EduVision/
├── backend/          # Django REST API
│   ├── apps/        # Django applications
│   ├── config/      # Project configuration
│   ├── manage.py    # Django management script
│   └── requirements.txt
└── frontend/        # Next.js application
    ├── src/
    │   └── app/    # Next.js app directory
    ├── public/     # Static assets
    └── package.json
```

## Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.11+** - [Download Python](https://www.python.org/downloads/)
- **Node.js 20+** - [Download Node.js](https://nodejs.org/)
- **PostgreSQL 14+** - [Download PostgreSQL](https://www.postgresql.org/download/)
- **Git** - [Download Git](https://git-scm.com/downloads)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd EduVision
```

### 2. Backend Setup (Django)

#### Create Virtual Environment

```bash
cd backend
python -m venv venv
```

#### Activate Virtual Environment

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

#### Install Dependencies

```bash
pip install -r requirements.txt
```

#### Configure Environment Variables

Create a `.env` file in the `backend` directory:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/eduvision_db
DB_CONN_MAX_AGE=60
SECRET_KEY=your-secret-key-here
DEBUG=True
```

**Note:** Replace `username`, `password`, and `eduvision_db` with your PostgreSQL credentials and database name.

#### Setup Database

```bash
# Create PostgreSQL database (run in psql or pgAdmin)
CREATE DATABASE eduvision_db;

# Run migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser
```

#### Run Backend Server

```bash
python manage.py runserver
```

The backend API will be available at [http://localhost:8000](http://localhost:8000)

### 3. Frontend Setup (Next.js)

Open a new terminal window:

```bash
cd frontend
```

#### Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

#### Configure Environment Variables (if needed)

Create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000)

## Available Scripts

### Backend (Django)

```bash
python manage.py runserver    # Start development server
python manage.py migrate       # Run database migrations
python manage.py makemigrations # Create new migrations
python manage.py createsuperuser # Create admin user
python manage.py test         # Run tests
```

### Frontend (Next.js)

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Development Workflow

1. **Start the Backend**: Navigate to `backend/` and run `python manage.py runserver`
2. **Start the Frontend**: Navigate to `frontend/` and run `npm run dev`
3. **Access the Application**: Open [http://localhost:3000](http://localhost:3000)
4. **Access Admin Panel**: Open [http://localhost:8000/admin](http://localhost:8000/admin)

## Tech Stack

### Backend
- Django 5.2.8
- Django REST Framework 3.16.1
- PostgreSQL (psycopg2-binary)
- Django CORS Headers

### Frontend
- Next.js 16.0.5
- React 19.2.0
- TypeScript 5
- Tailwind CSS 4
- ESLint

## Troubleshooting

### Backend Issues

**Database Connection Error:**
- Verify PostgreSQL is running
- Check DATABASE_URL in `.env` file
- Ensure database exists: `CREATE DATABASE eduvision_db;`

**Migration Errors:**
```bash
python manage.py migrate --run-syncdb
```

### Frontend Issues

**Module Not Found:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Port Already in Use:**
```bash
# Change port
npm run dev -- -p 3001
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the terms specified in the LICENSE file.

## Additional Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Tailwind CSS](https://tailwindcss.com/docs)
