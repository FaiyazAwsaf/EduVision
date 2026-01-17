"""
Custom runserver command that automatically starts Celery worker with Daphne.

Usage:
    python manage.py runserver         # Starts Daphne + Celery
    python manage.py runserver 8080    # Starts on port 8080
    python manage.py runserver --no-celery  # Starts without Celery

This overrides the default runserver to start both:
    - Daphne ASGI server (default behavior)
    - Celery worker (with solo pool for Windows compatibility)
"""
import os
import sys
import signal
import subprocess
import atexit
import threading


# Store celery process globally for cleanup
_celery_process = None
_celery_started = False


def start_celery_worker():
    """Start Celery worker as a subprocess."""
    global _celery_process, _celery_started
    
    if _celery_started:
        return
    
    _celery_started = True
    print('\033[92m' + 'Starting Celery worker...' + '\033[0m')
    
    # Get the Python executable from the current environment
    python_executable = sys.executable
    
    # Get the backend directory
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
    
    # Build Celery command
    celery_cmd = [
        python_executable,
        '-m', 'celery',
        '-A', 'config',
        'worker',
        '-l', 'info',
        '--pool=solo',  # Windows compatible
    ]
    
    # Start Celery as subprocess
    _celery_process = subprocess.Popen(
        celery_cmd,
        cwd=backend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0,
    )
    
    # Start a thread to read Celery output
    def read_celery_output():
        try:
            for line in _celery_process.stdout:
                print('\033[93m' + f'[Celery] {line.rstrip()}' + '\033[0m')
        except:
            pass
    
    celery_thread = threading.Thread(target=read_celery_output, daemon=True)
    celery_thread.start()
    
    print('\033[92m' + 'Celery worker started!' + '\033[0m')


def cleanup_celery():
    """Clean up Celery process on exit."""
    global _celery_process
    if _celery_process:
        print('\n\033[93m' + 'Shutting down Celery worker...' + '\033[0m')
        try:
            if sys.platform == 'win32':
                _celery_process.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                _celery_process.terminate()
            _celery_process.wait(timeout=5)
        except:
            try:
                _celery_process.kill()
            except:
                pass
        print('\033[92m' + 'Celery worker stopped.' + '\033[0m')


# Register cleanup
atexit.register(cleanup_celery)


# Import and extend Daphne's runserver command
from daphne.management.commands.runserver import Command as DaphneRunserverCommand


class Command(DaphneRunserverCommand):
    help = 'Runs Daphne development server with Celery worker'

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            '--no-celery',
            action='store_true',
            dest='no_celery',
            help='Run without Celery worker',
        )

    def handle(self, *args, **options):
        # Start Celery if not disabled
        if not options.get('no_celery', False):
            start_celery_worker()
        
        # Call the original Daphne runserver
        super().handle(*args, **options)
