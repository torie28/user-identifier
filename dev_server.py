#!/usr/bin/env python3
"""
Development server with live browser refresh
Run this instead of app.py for enhanced auto-refresh
"""
import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from flask_socketio import SocketIO, emit
from app import app

# Add SocketIO for live refresh
socketio = SocketIO(app, cors_allowed_origins="*")

class LiveReloadHandler(FileSystemEventHandler):
    """Handle file changes and trigger browser refresh"""
    
    def on_modified(self, event):
        if not event.is_directory:
            # Check if it's a file we care about
            file_ext = os.path.splitext(event.src_path)[1].lower()
            if file_ext in ['.html', '.css', '.js', '.py']:
                print(f"File changed: {event.src_path}")
                # Emit reload signal to browser
                socketio.emit('reload', {'message': 'File changed, reloading...'})

@socketio.on('connect')
def handle_connect():
    print('Client connected for live reload')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    # Set up file watcher
    event_handler = LiveReloadHandler()
    observer = Observer()
    
    # Watch these directories for changes
    watch_dirs = ['templates', 'static', 'models', 'controllers', '.']
    for watch_dir in watch_dirs:
        if os.path.exists(watch_dir):
            observer.schedule(event_handler, watch_dir, recursive=True)
    
    observer.start()
    
    try:
        print("🚀 Development server with live reload starting...")
        print("📁 Watching for file changes in:", ', '.join(watch_dirs))
        print("🌐 Open http://localhost:5000")
        
        # Initialize database
        from models import db
        db.init_app(app)
        with app.app_context():
            db.create_all()
        
        # Run with SocketIO
        socketio.run(app, debug=True, host='0.0.0.0', port=5000)
        
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
