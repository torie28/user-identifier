from flask import Flask, render_template, request, jsonify
from models.user import User
from controllers.user_controller import user_blueprint
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Register blueprints
app.register_blueprint(user_blueprint, url_prefix='/api/users')

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    from models import db
    db.init_app(app)
    with app.app_context():
        db.create_all()
    app.run(debug=True)
