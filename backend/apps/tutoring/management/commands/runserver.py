"""
Override Django's runserver command to use Daphne (ASGI) instead of the default WSGI server.
This ensures WebSocket support for tutoring sessions works out of the box.
"""
import os
import sys
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = "Runs Daphne ASGI server (with WebSocket support) instead of Django's WSGI server"

    def add_arguments(self, parser):
        parser.add_argument(
            'addrport',
            nargs='?',
            default='0.0.0.0:8000',
            help='Optional port number, or ipaddr:port'
        )
        parser.add_argument(
            '--verbosity',
            '-v',
            type=int,
            default=2,
            help='Verbosity level; 0=minimal output, 1=normal output, 2=verbose output'
        )

    def handle(self, *args, **options):
        addrport = options['addrport']
        verbosity = options['verbosity']

        # Parse address and port
        if ':' in addrport:
            addr, port = addrport.rsplit(':', 1)
        else:
            addr = '0.0.0.0'
            port = addrport

        self.stdout.write(self.style.SUCCESS(
            f'\nStarting Daphne ASGI server with WebSocket support...\n'
        ))
        self.stdout.write(
            f'   Listening on: http://{addr}:{port}\n'
            f'   ASGI Application: config.asgi:application\n'
            f'   Verbosity: {verbosity}\n'
        )

        # Import daphne CLI to run the server
        try:
            from daphne.cli import CommandLineInterface
        except ImportError:
            self.stdout.write(self.style.ERROR(
                '\nDaphne is not installed.\n'
                'Install it with: pip install daphne\n'
            ))
            sys.exit(1)

        # Build daphne command arguments
        daphne_args = [
            'daphne',
            '-b', addr,
            '-p', port,
            '-v', str(verbosity),
        ]

        # Add the ASGI application
        daphne_args.append('config.asgi:application')

        # Override sys.argv for daphne CLI
        sys.argv = daphne_args

        # Run daphne
        try:
            CommandLineInterface().run(daphne_args[1:])
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS('\n\nServer stopped.\n'))
            sys.exit(0)
